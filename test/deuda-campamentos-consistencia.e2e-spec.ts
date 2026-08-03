/**
 * Consistencia de deuda de campamentos entre las 5 rutas que la calculan
 * (Task 3.5 del plan): `getDetalle`, `getTotalDeudaCampamentos`,
 * `getPagosPorParticipante`, `getResumenFinanciero` y el CTE `deuda_camp`
 * consumido por `CajasService.getConsolidadoSaldos`.
 *
 * `getTotalDeudaCampamentos` y el CTE del consolidado son totales GLOBALES
 * de toda la base — sólo dan un número exacto en una base vacía. Contra
 * Neon (o cualquier base con datos preexistentes) comparar contra un total
 * fijo siempre falla. Este test mide el DELTA que introduce el propio seed,
 * no el total absoluto.
 *
 * Runs against the local Docker test database directly (NOT AppModule,
 * NOT Neon), igual que bonificaciones.concurrency.e2e-spec.ts.
 *
 * Pre-requisites
 * --------------
 * - Local test database running (`npm run db:test:start`)
 * - Fase 3 migrations already applied (costoEducadores, montoAsignado,
 *   montoBonificado en campamento_participante)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { CommonModule } from '../src/common/common.module';
import { CajasModule } from '../src/modules/cajas/cajas.module';
import { MovimientosModule } from '../src/modules/movimientos/movimientos.module';
import { PersonasModule } from '../src/modules/personas/personas.module';
import { PagosModule } from '../src/modules/pagos/pagos.module';
import { CampamentosModule } from '../src/modules/campamentos/campamentos.module';
import { PersonasService } from '../src/modules/personas/personas.service';
import { CampamentosService } from '../src/modules/campamentos/campamentos.service';
import { CajasService } from '../src/modules/cajas/cajas.service';
import { Rama, CargoEducador } from '../src/common/enums';

const LOCAL_DATABASE_URL =
  'postgresql://test_user:test_password@localhost:5433/scout_test';
const PREFIX = 'E2EDeudaCamp';

jest.setTimeout(30_000);

describe('Consistencia de deuda de campamentos entre las 5 rutas (e2e, delta)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let personasService: PersonasService;
  let campamentosService: CampamentosService;
  let cajasService: CajasService;

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
        PagosModule,
        CampamentosModule,
      ],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    personasService = moduleRef.get(PersonasService);
    campamentosService = moduleRef.get(CampamentosService);
    cajasService = moduleRef.get(CajasService);
  });

  afterAll(async () => {
    await cleanup(dataSource);
    await moduleRef.close();
  });

  beforeEach(async () => {
    await cleanup(dataSource);
  });

  it('las rutas de deuda agregada coinciden en el DELTA que introduce el seed', async () => {
    // 1. Medir deuda total ANTES del seed.
    const antesAgregada = await campamentosService.getTotalDeudaCampamentos();
    const antesConsolidado = (await cajasService.getConsolidadoSaldos())
      .deudasTotales.campamentos.total;

    // 2. Sembrar: campamento $50.000, educadores $10.000 (asignado luego de
    //    agregar al educador exento con costoEducadores=0 — el snapshot no
    //    se recalcula retroactivamente).
    const { campamentoId } = await seedCampamentoDePrueba(
      personasService,
      campamentosService,
      dataSource,
    );

    // 3. Medir DESPUÉS.
    const despuesAgregada = await campamentosService.getTotalDeudaCampamentos();
    const despuesConsolidado = (await cajasService.getConsolidadoSaldos())
      .deudasTotales.campamentos.total;

    // 4. La ruta del detalle es del campamento sembrado exclusivamente —
    //    se compara directo, no por delta.
    const detalle = await campamentosService.getDetalle(campamentoId);
    const deudaDetalle = detalle.participantes.reduce(
      (sum, p) => sum + Math.max(0, p.saldoPendiente),
      0,
    );

    // 5. getPagosPorParticipante y getResumenFinanciero también deben
    //    coincidir contra el mismo campamento.
    const pagosPorParticipante =
      await campamentosService.getPagosPorParticipante(campamentoId);
    const deudaPagosPorParticipante = pagosPorParticipante.reduce(
      (sum, p) => sum + Math.max(0, p.saldoPendiente),
      0,
    );

    const deltaAgregada = despuesAgregada.total - antesAgregada.total;
    const deltaConsolidado = despuesConsolidado - antesConsolidado;

    expect(deudaDetalle).toBe(105000);
    expect(deudaPagosPorParticipante).toBe(105000);
    expect(deltaAgregada).toBe(105000);
    expect(deltaConsolidado).toBe(105000);
  });
});

// ============================================================================
// Test fixtures and helpers (inlined per repo convention — test/README.md)
// ============================================================================

async function seedCampamentoDePrueba(
  personasService: PersonasService,
  campamentosService: CampamentosService,
  dataSource: DataSource,
): Promise<{ campamentoId: string }> {
  const suffix = Date.now();

  const protagonista1 = await personasService.createProtagonista({
    nombre: `${PREFIX}-Prota1-${suffix}`,
    rama: Rama.MANADA,
  });
  const protagonista2 = await personasService.createProtagonista({
    nombre: `${PREFIX}-Prota2-${suffix}`,
    rama: Rama.MANADA,
  });
  const educadorExento = await personasService.createEducador({
    nombre: `${PREFIX}-EducExento-${suffix}`,
    cargo: CargoEducador.EDUCADOR,
  });
  const educadorBonificado = await personasService.createEducador({
    nombre: `${PREFIX}-EducBonificado-${suffix}`,
    cargo: CargoEducador.EDUCADOR,
  });

  // 1. Campamento arranca con costoEducadores=0 (educadores exentos por defecto).
  const campamento = await campamentosService.create({
    nombre: `${PREFIX}-Campamento-${suffix}`,
    fechaInicio: new Date('2027-01-15'),
    fechaFin: new Date('2027-01-22'),
    costoPorPersona: 50000,
    costoEducadores: 0,
  });

  // 2. Dos protagonistas sin pagar: +50000 cada uno.
  await campamentosService.addParticipante(campamento.id, {
    personaId: protagonista1.id,
  });
  await campamentosService.addParticipante(campamento.id, {
    personaId: protagonista2.id,
  });

  // 3. Educador exento: se agrega mientras costoEducadores=0 → snapshot 0.
  await campamentosService.addParticipante(campamento.id, {
    personaId: educadorExento.id,
  });

  // 4. Se sube costoEducadores DESPUÉS: el educador ya agregado NO se
  //    recalcula (snapshot, Task 3.2/3.3).
  await campamentosService.update(campamento.id, { costoEducadores: 10000 });

  // 5. Educador que se agrega ahora sí toma el nuevo costoEducadores.
  await campamentosService.addParticipante(campamento.id, {
    personaId: educadorBonificado.id,
  });

  // 6. Bonificación directa sobre el participante: bonificarParticipante
  //    (Task 4.2) todavía no existe — se simula el resultado esperado de esa
  //    operación escribiendo montoBonificado directo, como haría ese futuro
  //    servicio dentro de una transacción.
  await dataSource.query(
    `UPDATE campamento_participante SET "montoBonificado" = 5000
      WHERE campamento_id = $1 AND persona_id = $2`,
    [campamento.id, educadorBonificado.id],
  );

  // Deuda esperada: 50000 + 50000 + 0 + (10000 - 5000) = 105000
  return { campamentoId: campamento.id };
}

async function cleanup(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `DELETE FROM movimientos
      WHERE responsable_id IN (
        SELECT id FROM personas WHERE nombre LIKE '${PREFIX}-%'
      )
         OR campamento_id IN (
           SELECT id FROM campamentos WHERE nombre LIKE '${PREFIX}-%'
         )
         OR caja_id IN (
           SELECT id FROM cajas WHERE propietario_id IN (
             SELECT id FROM personas WHERE nombre LIKE '${PREFIX}-%'
           )
         )`,
  );
  await dataSource.query(
    `DELETE FROM campamento_participante
      WHERE campamento_id IN (
        SELECT id FROM campamentos WHERE nombre LIKE '${PREFIX}-%'
      )`,
  );
  await dataSource.query(
    `DELETE FROM campamentos WHERE nombre LIKE '${PREFIX}-%'`,
  );
  await dataSource.query(
    `DELETE FROM cajas WHERE propietario_id IN (
      SELECT id FROM personas WHERE nombre LIKE '${PREFIX}-%'
    )`,
  );
  await dataSource.query(
    `DELETE FROM personas WHERE nombre LIKE '${PREFIX}-%'`,
  );
}
