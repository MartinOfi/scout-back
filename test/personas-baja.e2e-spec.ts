/**
 * E2E coverage for POST /api/v1/personas/:id/dar-de-baja
 *
 * Covers:
 * 1. Happy path: balance > 0 → atomic transfer to caja grupo,
 *    personal caja drained, persona.estado untouched, two linked
 *    movimientos with concepto = TRANSFERENCIA_BAJA, medioPago = EFECTIVO.
 * 2. Idempotent: balance === 0 → response saldoTransferido 0, no movimientos created.
 * 3. Double trigger: second POST after a successful first one is a clean no-op.
 *
 * Pre-requisites
 * --------------
 * - Test database running (`npm run db:test:start`)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  Persona,
  Protagonista,
} from '../src/modules/personas/entities/persona.entity';
import { Caja } from '../src/modules/cajas/entities/caja.entity';
import { Movimiento } from '../src/modules/movimientos/entities/movimiento.entity';
import {
  CajaType,
  ConceptoMovimiento,
  EstadoPago,
  EstadoPersona,
  MedioPago,
  PersonaType,
  Rama,
  TipoMovimiento,
} from '../src/common/enums';

const API_PREFIX = '/api/v1';

jest.setTimeout(30_000);

describe('Personas > dar-de-baja (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let cajaGrupo: Caja;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    // Clean any leftover state from prior runs before touching personas table
    await cleanupForBajaTests(dataSource);
    authToken = await ensureAuthUserAndGetToken(app, dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanupForBajaTests(dataSource);
    cajaGrupo = await ensureCajaGrupo(dataSource);
  });

  it('happy path: transfiere todo el saldo a la caja grupo, deja personal en 0, no cambia estado', async () => {
    const { persona, cajaPersonal } =
      await createProtagonistaConCajaPersonal(dataSource);
    await seedIngreso(dataSource, cajaPersonal.id, persona.id, 1500);

    const grupoBefore = await calcularSaldoRaw(dataSource, cajaGrupo.id);

    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/personas/${persona.id}/dar-de-baja`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(Number(response.body.saldoTransferido)).toBe(1500);

    expect(await calcularSaldoRaw(dataSource, cajaPersonal.id)).toBe(0);
    expect(await calcularSaldoRaw(dataSource, cajaGrupo.id)).toBe(
      grupoBefore + 1500,
    );

    const movimientos = await dataSource.getRepository(Movimiento).find({
      where: { concepto: ConceptoMovimiento.TRANSFERENCIA_BAJA },
      order: { tipo: 'ASC' },
    });
    expect(movimientos).toHaveLength(2);
    for (const m of movimientos) {
      expect(m.medioPago).toBe(MedioPago.EFECTIVO);
      expect(m.movimientoRelacionadoId).toBeTruthy();
    }
    // Bidirectional link
    expect(movimientos[0].movimientoRelacionadoId).toBe(movimientos[1].id);
    expect(movimientos[1].movimientoRelacionadoId).toBe(movimientos[0].id);

    const personaRefetched = await dataSource
      .getRepository(Persona)
      .findOne({ where: { id: persona.id } });
    expect(personaRefetched?.estado).toBe(EstadoPersona.ACTIVO);
  });

  it('idempotente: persona con saldo 0 → saldoTransferido 0, no crea movimientos', async () => {
    const { persona, cajaPersonal } =
      await createProtagonistaConCajaPersonal(dataSource);

    const response = await request(app.getHttpServer())
      .post(`${API_PREFIX}/personas/${persona.id}/dar-de-baja`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(Number(response.body.saldoTransferido)).toBe(0);

    const movimientos = await dataSource
      .getRepository(Movimiento)
      .find({ where: { concepto: ConceptoMovimiento.TRANSFERENCIA_BAJA } });
    expect(movimientos).toHaveLength(0);

    expect(await calcularSaldoRaw(dataSource, cajaPersonal.id)).toBe(0);

    const personaRefetched = await dataSource
      .getRepository(Persona)
      .findOne({ where: { id: persona.id } });
    expect(personaRefetched?.estado).toBe(EstadoPersona.ACTIVO);
  });

  it('doble disparo seguro: el segundo POST es no-op', async () => {
    const { persona, cajaPersonal } =
      await createProtagonistaConCajaPersonal(dataSource);
    await seedIngreso(dataSource, cajaPersonal.id, persona.id, 1500);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/personas/${persona.id}/dar-de-baja`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`${API_PREFIX}/personas/${persona.id}/dar-de-baja`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(Number(second.body.saldoTransferido)).toBe(0);

    const movimientos = await dataSource
      .getRepository(Movimiento)
      .find({ where: { concepto: ConceptoMovimiento.TRANSFERENCIA_BAJA } });
    expect(movimientos).toHaveLength(2); // del primer disparo solamente
  });
});

// ============================================================================
// Test fixtures and helpers (inlined per repo convention)
// ============================================================================

async function ensureAuthUserAndGetToken(
  app: INestApplication<App>,
  dataSource: DataSource,
): Promise<string> {
  const personaRepo = dataSource.getRepository(Persona);
  const authUserName = 'E2EBajaAuthUser';
  const authUserEmail = `e2e-baja-auth-${Date.now()}@example.com`;
  const authUserPassword = 'Password123!';

  // Clean up any prior auth user from earlier runs (and its refresh tokens)
  await dataSource.query(
    `DELETE FROM refresh_tokens WHERE persona_id IN (SELECT id FROM personas WHERE nombre = $1)`,
    [authUserName],
  );
  await dataSource.query(`DELETE FROM personas WHERE nombre = $1`, [
    authUserName,
  ]);

  const educador = await personaRepo.save(
    personaRepo.create({
      nombre: authUserName,
      tipo: PersonaType.EDUCADOR,
      estado: EstadoPersona.ACTIVO,
      email: null,
      passwordHash: null,
    } as Partial<Persona>),
  );

  const response = await request(app.getHttpServer())
    .post(`${API_PREFIX}/auth/register`)
    .send({
      personaId: educador.id,
      email: authUserEmail,
      password: authUserPassword,
    })
    .expect(201);

  const token = response.body.accessToken as string | undefined;
  if (!token) {
    throw new Error('Auth register did not return accessToken');
  }
  return token;
}

async function cleanupForBajaTests(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM movimientos');
  await dataSource.query(`DELETE FROM cajas WHERE tipo <> 'grupo'`);
  await dataSource.query(`DELETE FROM personas WHERE nombre LIKE 'E2EBaja-%'`);
}

async function ensureCajaGrupo(dataSource: DataSource): Promise<Caja> {
  const repo = dataSource.getRepository(Caja);
  const existing = await repo.findOne({ where: { tipo: CajaType.GRUPO } });
  if (existing) return existing;
  const created = repo.create({
    tipo: CajaType.GRUPO,
    nombre: 'Caja Grupo (E2E Baja)',
  } as Partial<Caja>);
  return repo.save(created);
}

async function createProtagonistaConCajaPersonal(
  dataSource: DataSource,
): Promise<{ persona: Persona; cajaPersonal: Caja }> {
  const personaRepo = dataSource.getRepository(Protagonista);
  const cajaRepo = dataSource.getRepository(Caja);

  const persona = await personaRepo.save(
    personaRepo.create({
      nombre: `E2EBaja-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tipo: PersonaType.PROTAGONISTA,
      estado: EstadoPersona.ACTIVO,
      rama: Rama.MANADA,
    } as Partial<Protagonista>),
  );

  const cajaPersonal = await cajaRepo.save(
    cajaRepo.create({
      tipo: CajaType.PERSONAL,
      nombre: `Caja Personal ${persona.nombre}`,
      propietarioId: persona.id,
    } as Partial<Caja>),
  );

  return { persona, cajaPersonal };
}

async function seedIngreso(
  dataSource: DataSource,
  cajaId: string,
  responsableId: string,
  monto: number,
): Promise<void> {
  const repo = dataSource.getRepository(Movimiento);
  await repo.save(
    repo.create({
      cajaId,
      tipo: TipoMovimiento.INGRESO,
      monto,
      concepto: ConceptoMovimiento.AJUSTE_INICIAL,
      descripcion: 'Seed E2E',
      responsableId,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PAGADO,
      requiereComprobante: false,
      fecha: new Date(),
    } as Partial<Movimiento>),
  );
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
    .getRawOne();
  return Number(result?.saldo ?? 0);
}
