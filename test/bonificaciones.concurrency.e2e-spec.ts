/**
 * E2E coverage for BonificacionesService.otorgarConManager under real
 * Postgres concurrency (spec §10 — "el test más importante del diseño").
 *
 * The unit tests in bonificaciones.service.spec.ts mock `manager.query`, so
 * none of them prove the `FOR UPDATE` lock actually serializes two
 * concurrent transactions against the same fondo solidario. That can only
 * be proven against a real database: two transactions are opened at the
 * same time, each tries to otorgar más de la mitad del saldo disponible,
 * and exactly one of them must succeed — never both (overdraft) and never
 * neither (lock over-blocking).
 *
 * Runs against the local Docker test database directly (NOT AppModule,
 * NOT Neon) via its own DataSource: AppModule hardcodes `.env.local` and
 * `ssl: { rejectUnauthorized: false }` (see src/database/database.module.ts),
 * which breaks against the local, non-TLS Docker Postgres. This suite
 * builds a minimal module graph (CommonModule + CajasModule +
 * MovimientosModule + PersonasModule + BonificacionesModule, which pull in
 * InscripcionesModule/CuotasModule/CampamentosModule/PagosModule via
 * forwardRef) so the real services run unmodified against localhost:5433.
 *
 * Pre-requisites
 * --------------
 * - Local test database running (`npm run db:test:start`)
 * - Fase 0 enum migrations already applied to it (bonificacion_otorgada /
 *   bonificacion_recibida values on movimientos_concepto_enum, and
 *   fondo_solidario on cajas_tipo_enum)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import * as path from 'path';
import { CommonModule } from '../src/common/common.module';
import { CajasModule } from '../src/modules/cajas/cajas.module';
import { MovimientosModule } from '../src/modules/movimientos/movimientos.module';
import { PersonasModule } from '../src/modules/personas/personas.module';
import { BonificacionesModule } from '../src/modules/bonificaciones/bonificaciones.module';
import { PersonasService } from '../src/modules/personas/personas.service';
import { Protagonista } from '../src/modules/personas/entities/persona.entity';
import { BonificacionesService } from '../src/modules/bonificaciones/bonificaciones.service';
import { Caja } from '../src/modules/cajas/entities/caja.entity';
import { Movimiento } from '../src/modules/movimientos/entities/movimiento.entity';
import {
  CajaType,
  CargoEducador,
  ConceptoMovimiento,
  EstadoPago,
  MedioPago,
  Rama,
  TipoMovimiento,
} from '../src/common/enums';

const LOCAL_DATABASE_URL =
  'postgresql://test_user:test_password@localhost:5433/scout_test';
const PREFIX = 'E2EBonifConcurrencia';

jest.setTimeout(30_000);

describe('Bonificaciones > concurrencia real con Postgres (e2e)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let personasService: PersonasService;
  let bonificacionesService: BonificacionesService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: LOCAL_DATABASE_URL,
          entities: [
            path.join(__dirname, '..', 'src', '**', '*.entity{.ts,.js}'),
          ],
          synchronize: false,
          migrationsRun: false,
        }),
        CommonModule,
        CajasModule,
        MovimientosModule,
        PersonasModule,
        BonificacionesModule,
      ],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    personasService = moduleRef.get(PersonasService);
    bonificacionesService = moduleRef.get(BonificacionesService);
  });

  afterAll(async () => {
    await cleanup(dataSource);
    await moduleRef.close();
  });

  beforeEach(async () => {
    await cleanup(dataSource);
    await ensureCajaGrupo(dataSource);
  });

  it('serializa dos otorgamientos concurrentes: exactamente uno tiene éxito cuando juntos exceden el saldo', async () => {
    const fondo = await seedFondoSolidario(dataSource, 10_000);
    const persona1 = await personasService.createProtagonista({
      nombre: `${PREFIX}-Prota-${Date.now()}`,
      rama: Rama.MANADA,
    });
    const persona2 = await personasService.createEducador({
      nombre: `${PREFIX}-Educ-${Date.now()}`,
      cargo: CargoEducador.EDUCADOR,
    });

    const resultados = await Promise.allSettled([
      dataSource.transaction((manager: EntityManager) =>
        bonificacionesService.otorgarConManager(manager, {
          personaId: persona1.id,
          monto: 6000,
        }),
      ),
      dataSource.transaction((manager: EntityManager) =>
        bonificacionesService.otorgarConManager(manager, {
          personaId: persona2.id,
          monto: 6000,
        }),
      ),
    ]);

    const fulfilled = resultados.filter((r) => r.status === 'fulfilled');
    const rejected = resultados.filter((r) => r.status === 'rejected');

    // Nunca las dos: sería sobregiro del fondo ($12.000 sobre $10.000).
    // Nunca ninguna: sería el lock bloqueando de más.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const saldoFinal = await calcularSaldoRaw(dataSource, fondo.id);
    expect(saldoFinal).toBe(4000);

    const egresos = await dataSource.getRepository(Movimiento).find({
      where: {
        cajaId: fondo.id,
        concepto: ConceptoMovimiento.BONIFICACION_OTORGADA,
      },
    });
    expect(egresos).toHaveLength(1);
  });
});

// ============================================================================
// Test fixtures and helpers (inlined per repo convention — test/README.md)
// ============================================================================

/**
 * Scoped cleanup — NUNCA usa `DELETE FROM <tabla>` sin `WHERE`.
 *
 * Borra movimientos referenciados por personas de este suite (prefijo
 * E2EBonifConcurrencia) o por la caja de fondo solidario, después la caja
 * de fondo solidario, y por último las personas de test. La caja fondo
 * solidario es un singleton dedicado a esta feature (como `tipo = GRUPO`
 * en personas-baja.e2e-spec.ts) — no lleva prefijo propio porque solo
 * existe un valor posible de `tipo`, pero el DELETE queda igual de acotado.
 */
async function cleanup(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `DELETE FROM movimientos
      WHERE responsable_id IN (
        SELECT id FROM personas WHERE nombre LIKE '${PREFIX}%'
      )
         OR caja_id IN (
           SELECT id FROM cajas WHERE tipo = 'fondo_solidario'
              OR propietario_id IN (
                SELECT id FROM personas WHERE nombre LIKE '${PREFIX}%'
              )
         )`,
  );
  await dataSource.query(
    `DELETE FROM cajas
      WHERE tipo = 'fondo_solidario'
         OR propietario_id IN (
           SELECT id FROM personas WHERE nombre LIKE '${PREFIX}%'
         )`,
  );
  await dataSource.query(`DELETE FROM personas WHERE nombre LIKE '${PREFIX}%'`);
}

async function ensureCajaGrupo(dataSource: DataSource): Promise<Caja> {
  const repo = dataSource.getRepository(Caja);
  const existing = await repo.findOne({ where: { tipo: CajaType.GRUPO } });
  if (existing) return existing;
  const created = repo.create({
    tipo: CajaType.GRUPO,
    nombre: 'Caja Grupo (E2E Concurrencia)',
  } as Partial<Caja>);
  return repo.save(created);
}

async function seedFondoSolidario(
  dataSource: DataSource,
  monto: number,
): Promise<Caja> {
  const cajaRepo = dataSource.getRepository(Caja);
  const fondo = await cajaRepo.save(
    cajaRepo.create({
      tipo: CajaType.FONDO_SOLIDARIO,
      nombre: 'Fondo Solidario (E2E Concurrencia)',
    } as Partial<Caja>),
  );

  const protagonistaRepo = dataSource.getRepository(Protagonista);
  const seedResponsable = await protagonistaRepo.save(
    protagonistaRepo.create({
      nombre: `${PREFIX}-Seed-${Date.now()}`,
      rama: Rama.MANADA,
    } as Partial<Protagonista>),
  );

  const movRepo = dataSource.getRepository(Movimiento);
  await movRepo.save(
    movRepo.create({
      cajaId: fondo.id,
      tipo: TipoMovimiento.INGRESO,
      monto,
      concepto: ConceptoMovimiento.AJUSTE_INICIAL,
      descripcion: 'Seed E2E Concurrencia',
      responsableId: seedResponsable.id,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PAGADO,
      requiereComprobante: false,
      fecha: new Date(),
    } as Partial<Movimiento>),
  );

  return fondo;
}

async function calcularSaldoRaw(
  dataSource: DataSource,
  cajaId: string,
): Promise<number> {
  const result = await dataSource
    .getRepository(Movimiento)
    .createQueryBuilder('m')
    .select(
      "COALESCE(SUM(CASE WHEN m.tipo = 'ingreso' THEN m.monto ELSE -m.monto END), 0)",
      'saldo',
    )
    .where('m.cajaId = :cajaId', { cajaId })
    .getRawOne<{ saldo: string | null }>();
  return Number(result?.saldo ?? 0);
}
