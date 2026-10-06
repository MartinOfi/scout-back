/**
 * Integración de InscripcionesService.eliminarPago contra Postgres REAL.
 *
 * Regresión del bug "no deja eliminar pagos": el front borraba el pago con
 * DELETE /movimientos/:id, que el DeletionValidator bloquea para pagos de
 * inscripción. El pago se elimina ahora desde la inscripción; este spec
 * prueba que los saldos de caja grupo y caja personal vuelven a cuadrar
 * (la regla de saldo vive en SQL, un mock no la prueba) y que el borrado
 * directo del movimiento sigue bloqueado.
 *
 * Igual que movimientos-saldo.e2e-spec.ts, NO levanta AppModule (que apunta
 * a .env.local y corre migraciones): usa su propia conexión al docker de test.
 *
 * Pre-requisitos: `npm run db:test:start`
 */

import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InscripcionesService } from '../src/modules/inscripciones/inscripciones.service';
import { Inscripcion } from '../src/modules/inscripciones/entities/inscripcion.entity';
import { MovimientosService } from '../src/modules/movimientos/movimientos.service';
import { Movimiento } from '../src/modules/movimientos/entities/movimiento.entity';
import { VentaProducto } from '../src/modules/eventos/entities/venta-producto.entity';
import { DeletionValidatorService } from '../src/common/services/deletion-validator.service';
import {
  ConceptoMovimiento,
  EstadoInscripcion,
  EstadoPago,
  MedioPago,
  TipoInscripcion,
  TipoMovimiento,
} from '../src/common/enums';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://test_user:test_password@localhost:5433/scout_test';

/** Prefijo de todo lo que crea este spec; el cleanup solo toca esas filas. */
const E2E_PREFIX = 'E2EElimPago';

const MONTO_FISICO = 3000;
const MONTO_SALDO_PERSONAL = 2000;
const SALDO_PERSONAL_INICIAL = 5000;

describe('InscripcionesService.eliminarPago (integración, DB real)', () => {
  let dataSource: DataSource;
  let inscripciones: InscripcionesService;
  let movimientos: MovimientosService;
  let personaId: string;
  let cajaGrupoId: string;
  let cajaPersonalId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: TEST_DB_URL,
      entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
    await cleanupScoped(dataSource);

    const movRepo = dataSource.getRepository(Movimiento);
    const validator = new DeletionValidatorService(
      movRepo,
      dataSource.getRepository(VentaProducto),
    );
    // Solo se usan repositorio, dataSource y validator; el resto queda undefined.
    movimientos = new MovimientosService(
      movRepo,
      undefined as never,
      undefined as never,
      dataSource,
      validator,
    );
    inscripciones = new InscripcionesService(
      dataSource.getRepository(Inscripcion),
      undefined as never,
      movimientos,
      undefined as never,
      undefined as never,
      dataSource,
      validator,
    );

    const [persona]: { id: string }[] = await dataSource.query(
      `INSERT INTO "personas" ("id","tipo","nombre","estado","emailVerified","rama")
       VALUES (gen_random_uuid(),'protagonista',$1,'activo',false,'Rovers')
       RETURNING "id"`,
      [`${E2E_PREFIX}-Scout`],
    );
    personaId = persona.id;
    cajaGrupoId = await insertCaja('grupo', `${E2E_PREFIX}-Grupo`, null);
    cajaPersonalId = await insertCaja(
      'personal',
      `${E2E_PREFIX}-Personal`,
      personaId,
    );
  });

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    await cleanupScoped(dataSource);
    await dataSource.destroy();
  });

  async function insertCaja(
    tipo: string,
    nombre: string,
    propietarioId: string | null,
  ): Promise<string> {
    const [caja]: { id: string }[] = await dataSource.query(
      `INSERT INTO "cajas" ("id","tipo","nombre","propietario_id")
       VALUES (gen_random_uuid(),$1,$2,$3) RETURNING "id"`,
      [tipo, nombre, propietarioId],
    );
    return caja.id;
  }

  async function insertMovimiento(
    data: Partial<Movimiento>,
  ): Promise<Movimiento> {
    return dataSource.getRepository(Movimiento).save({
      responsableId: personaId,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PAGADO,
      fecha: new Date(),
      ...data,
    });
  }

  /** Reproduce lo que PagosService deja en la DB para un pago mixto. */
  async function seedPagoMixto(): Promise<{
    inscripcionId: string;
    ingreso: Movimiento;
    egreso: Movimiento;
  }> {
    const inscripcion = await dataSource.getRepository(Inscripcion).save({
      personaId,
      tipo: TipoInscripcion.SCOUT_ARGENTINA,
      ano: 2099,
      montoTotal: MONTO_FISICO + MONTO_SALDO_PERSONAL,
      montoBonificado: 0,
    });
    await insertMovimiento({
      cajaId: cajaPersonalId,
      tipo: TipoMovimiento.INGRESO,
      monto: SALDO_PERSONAL_INICIAL,
      concepto: ConceptoMovimiento.AJUSTE_INICIAL,
    });
    const egreso = await insertMovimiento({
      cajaId: cajaPersonalId,
      tipo: TipoMovimiento.EGRESO,
      monto: MONTO_SALDO_PERSONAL,
      concepto: ConceptoMovimiento.USO_SALDO_PERSONAL,
      inscripcionId: inscripcion.id,
    });
    const ingreso = await insertMovimiento({
      cajaId: cajaGrupoId,
      tipo: TipoMovimiento.INGRESO,
      monto: MONTO_FISICO + MONTO_SALDO_PERSONAL,
      concepto: ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA,
      inscripcionId: inscripcion.id,
      movimientoRelacionadoId: egreso.id,
    });
    await dataSource
      .getRepository(Movimiento)
      .update(egreso.id, { movimientoRelacionadoId: ingreso.id });
    return { inscripcionId: inscripcion.id, ingreso, egreso };
  }

  it('elimina el pago y devuelve los saldos de caja grupo y personal a su valor previo', async () => {
    const { inscripcionId, ingreso } = await seedPagoMixto();
    expect(await movimientos.calcularSaldo(cajaGrupoId)).toBe(
      MONTO_FISICO + MONTO_SALDO_PERSONAL,
    );
    expect(await movimientos.calcularSaldo(cajaPersonalId)).toBe(
      SALDO_PERSONAL_INICIAL - MONTO_SALDO_PERSONAL,
    );

    const result = await inscripciones.eliminarPago(inscripcionId, ingreso.id);

    expect(result.estado).toBe(EstadoInscripcion.PENDIENTE);
    expect(result.movimientos).toHaveLength(0);
    expect(await movimientos.calcularSaldo(cajaGrupoId)).toBe(0);
    expect(await movimientos.calcularSaldo(cajaPersonalId)).toBe(
      SALDO_PERSONAL_INICIAL,
    );
  });

  it('el borrado directo del movimiento sigue bloqueado con un mensaje claro', async () => {
    await cleanupMovimientos(dataSource);
    await dataSource
      .getRepository(Inscripcion)
      .delete({ personaId, ano: 2099 });
    const { ingreso } = await seedPagoMixto();

    await expect(movimientos.remove(ingreso.id)).rejects.toThrow(
      BadRequestException,
    );
    await expect(movimientos.remove(ingreso.id)).rejects.toThrow(
      /eliminá el pago desde la inscripción/,
    );
  });
});

async function cleanupMovimientos(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `DELETE FROM "movimientos" WHERE "caja_id" IN (
       SELECT "id" FROM "cajas" WHERE "nombre" LIKE $1
     )`,
    [`${E2E_PREFIX}%`],
  );
}

async function cleanupScoped(dataSource: DataSource): Promise<void> {
  const like = `${E2E_PREFIX}%`;
  await cleanupMovimientos(dataSource);
  await dataSource.query(
    `DELETE FROM "inscripciones" WHERE "persona_id" IN (
       SELECT "id" FROM "personas" WHERE "nombre" LIKE $1
     )`,
    [like],
  );
  await dataSource.query(`DELETE FROM "cajas" WHERE "nombre" LIKE $1`, [like]);
  await dataSource.query(`DELETE FROM "personas" WHERE "nombre" LIKE $1`, [
    like,
  ]);
}
