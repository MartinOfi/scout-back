/**
 * Integration coverage for MovimientosService.calcularSaldo /
 * calcularSaldosBatch against a REAL Postgres.
 *
 * Why not a unit spec
 * -------------------
 * The rule under test lives in a SQL CASE expression, not in TypeScript. The
 * existing unit specs mock the QueryBuilder, so they can prove the wiring but
 * never the semantics — a mocked builder returns whatever we tell it to,
 * including for balances that the real SQL would compute differently. Money
 * rules get a real database.
 *
 * Why its own DataSource
 * ----------------------
 * It deliberately does NOT import AppModule. AppModule hardcodes
 * `envFilePath: '.env.local'` (app.module.ts) and DatabaseModule runs with
 * `migrationsRun: true`, so booting it from a test connects to whatever
 * .env.local points at — in this project, the cloud database — and applies
 * pending migrations to it. This spec builds its own connection to the local
 * docker test DB instead, so it cannot reach anything else.
 *
 * Pre-requisites: `npm run db:test:start`
 */

import { DataSource, Repository } from 'typeorm';
import { MovimientosService } from '../src/modules/movimientos/movimientos.service';
import { Movimiento } from '../src/modules/movimientos/entities/movimiento.entity';
import {
  ConceptoMovimiento,
  EstadoPago,
  MedioPago,
  TipoMovimiento,
} from '../src/common/enums';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://test_user:test_password@localhost:5433/scout_test';

/**
 * Prefix for every row this suite creates (test/README.md, Rule 2). Cleanup
 * only ever touches rows carrying it, so even if the connection above were
 * pointed somewhere real the blast radius stays zero.
 */
const E2E_PREFIX = 'E2ESaldo';

interface MovimientoSeed {
  tipo: TipoMovimiento;
  monto: number;
  estadoPago: EstadoPago;
}

describe('MovimientosService — saldo (integración, DB real)', () => {
  let dataSource: DataSource;
  let service: MovimientosService;
  let repo: Repository<Movimiento>;
  let cajaId: string;
  let otraCajaId: string;
  let responsableId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: TEST_DB_URL,
      entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();

    repo = dataSource.getRepository(Movimiento);
    // calcularSaldo/calcularSaldosBatch only touch the repository; the other
    // constructor dependencies are irrelevant here and stay undefined.
    service = new MovimientosService(
      repo,
      undefined as never,
      undefined as never,
      dataSource,
      undefined as never,
    );

    await cleanupScoped(dataSource);

    const [persona]: { id: string }[] = await dataSource.query(
      `INSERT INTO "personas" ("id","tipo","nombre","estado","emailVerified","rama")
       VALUES (gen_random_uuid(),'protagonista',$1,'activo',false,'Rovers')
       RETURNING "id"`,
      [`${E2E_PREFIX}-Vendedor`],
    );
    responsableId = persona.id;

    const [caja]: { id: string }[] = await dataSource.query(
      `INSERT INTO "cajas" ("id","tipo","nombre")
       VALUES (gen_random_uuid(),'grupo',$1) RETURNING "id"`,
      [`${E2E_PREFIX}-Caja1`],
    );
    cajaId = caja.id;

    const [caja2]: { id: string }[] = await dataSource.query(
      `INSERT INTO "cajas" ("id","tipo","nombre")
       VALUES (gen_random_uuid(),'rama_rovers',$1) RETURNING "id"`,
      [`${E2E_PREFIX}-Caja2`],
    );
    otraCajaId = caja2.id;
  });

  afterAll(async () => {
    if (!dataSource?.isInitialized) return;
    await cleanupScoped(dataSource);
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(
      `DELETE FROM "movimientos" WHERE "caja_id" IN (
         SELECT "id" FROM "cajas" WHERE "nombre" LIKE $1
       )`,
      [`${E2E_PREFIX}%`],
    );
  });

  async function seed(
    movimientos: MovimientoSeed[],
    targetCajaId = cajaId,
  ): Promise<void> {
    for (const m of movimientos) {
      await dataSource.query(
        `INSERT INTO "movimientos"
           ("id","caja_id","tipo","monto","concepto","responsable_id","medioPago","estadoPago","fecha")
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7, now())`,
        [
          targetCajaId,
          m.tipo,
          m.monto,
          m.tipo === TipoMovimiento.INGRESO
            ? ConceptoMovimiento.EVENTO_VENTA_INGRESO
            : ConceptoMovimiento.GASTO_GENERAL,
          responsableId,
          MedioPago.EFECTIVO,
          m.estadoPago,
        ],
      );
    }
  }

  describe('regresión: el comportamiento histórico no cambia', () => {
    it('ingresos pagados suman y egresos pagados restan', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 1000,
          estadoPago: EstadoPago.PAGADO,
        },
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 500,
          estadoPago: EstadoPago.PAGADO,
        },
        {
          tipo: TipoMovimiento.EGRESO,
          monto: 300,
          estadoPago: EstadoPago.PAGADO,
        },
      ]);

      expect(await service.calcularSaldo(cajaId)).toBe(1200);
    });

    it('un egreso PENDIENTE_REEMBOLSO no reduce el saldo: la plata sigue en la caja', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 1000,
          estadoPago: EstadoPago.PAGADO,
        },
        {
          tipo: TipoMovimiento.EGRESO,
          monto: 400,
          estadoPago: EstadoPago.PENDIENTE_REEMBOLSO,
        },
      ]);

      expect(await service.calcularSaldo(cajaId)).toBe(1000);
    });

    it('una caja sin movimientos da 0', async () => {
      expect(await service.calcularSaldo(cajaId)).toBe(0);
    });
  });

  describe('PENDIENTE_COBRO: plata registrada que todavía no entró', () => {
    it('un ingreso PENDIENTE_COBRO NO suma al saldo', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 1000,
          estadoPago: EstadoPago.PAGADO,
        },
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 750,
          estadoPago: EstadoPago.PENDIENTE_COBRO,
        },
      ]);

      expect(await service.calcularSaldo(cajaId)).toBe(1000);
    });

    it('al cobrarse (pasa a PAGADO) suma por el monto exacto', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 750,
          estadoPago: EstadoPago.PENDIENTE_COBRO,
        },
      ]);
      expect(await service.calcularSaldo(cajaId)).toBe(0);

      await dataSource.query(
        `UPDATE "movimientos" SET "estadoPago" = $1 WHERE "caja_id" = $2`,
        [EstadoPago.PAGADO, cajaId],
      );

      expect(await service.calcularSaldo(cajaId)).toBe(750);
    });

    it('convive con PENDIENTE_REEMBOLSO sin interferencias', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 2000,
          estadoPago: EstadoPago.PAGADO,
        },
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 900,
          estadoPago: EstadoPago.PENDIENTE_COBRO,
        },
        {
          tipo: TipoMovimiento.EGRESO,
          monto: 500,
          estadoPago: EstadoPago.PAGADO,
        },
        {
          tipo: TipoMovimiento.EGRESO,
          monto: 300,
          estadoPago: EstadoPago.PENDIENTE_REEMBOLSO,
        },
      ]);

      // 2000 (ingreso pagado) - 500 (egreso pagado). Los dos pendientes no mueven nada.
      expect(await service.calcularSaldo(cajaId)).toBe(1500);
    });
  });

  describe('calcularSaldosBatch coincide con calcularSaldo', () => {
    it('las dos copias del CASE no pueden divergir', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 2000,
          estadoPago: EstadoPago.PAGADO,
        },
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 900,
          estadoPago: EstadoPago.PENDIENTE_COBRO,
        },
        {
          tipo: TipoMovimiento.EGRESO,
          monto: 300,
          estadoPago: EstadoPago.PENDIENTE_REEMBOLSO,
        },
      ]);
      await seed(
        [
          {
            tipo: TipoMovimiento.INGRESO,
            monto: 100,
            estadoPago: EstadoPago.PENDIENTE_COBRO,
          },
        ],
        otraCajaId,
      );

      const batch = await service.calcularSaldosBatch([cajaId, otraCajaId]);

      expect(batch.get(cajaId)).toBe(await service.calcularSaldo(cajaId));
      expect(batch.get(otraCajaId)).toBe(
        await service.calcularSaldo(otraCajaId),
      );
      expect(batch.get(otraCajaId)).toBe(0);
    });
  });

  describe('cobros pendientes: quién nos debe', () => {
    it('agrupa lo no cobrado por responsable y suma el total', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 900,
          estadoPago: EstadoPago.PENDIENTE_COBRO,
        },
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 350,
          estadoPago: EstadoPago.PENDIENTE_COBRO,
        },
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 5000,
          estadoPago: EstadoPago.PAGADO,
        },
      ]);

      const pendientes = await service.findCobrosPendientes();
      const mio = pendientes.find((p) => p.personaId === responsableId);

      expect(mio).toBeDefined();
      expect(mio?.totalPendiente).toBe(1250);
      expect(mio?.movimientos).toHaveLength(2);
    });

    it('el resumen coincide con el detalle y excluye lo ya cobrado', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 900,
          estadoPago: EstadoPago.PENDIENTE_COBRO,
        },
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 350,
          estadoPago: EstadoPago.PENDIENTE_COBRO,
        },
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 5000,
          estadoPago: EstadoPago.PAGADO,
        },
      ]);

      const resumen = await service.getCobrosPendientesResumen();

      expect(resumen.total).toBe(1250);
      expect(resumen.cantidad).toBe(1);
    });

    it('un responsable con todo cobrado no figura como deudor', async () => {
      await seed([
        {
          tipo: TipoMovimiento.INGRESO,
          monto: 5000,
          estadoPago: EstadoPago.PAGADO,
        },
      ]);

      const pendientes = await service.findCobrosPendientes();

      expect(
        pendientes.find((p) => p.personaId === responsableId),
      ).toBeUndefined();
    });
  });
});

// ============================================================================
// Cleanup: scoped por prefijo (test/README.md, Rule 2 y 4). Inline a propósito:
// no existe helper compartido que alguien pueda importar y disparar contra otra
// base. Orden de borrado según FKs: movimientos -> cajas -> personas.
// ============================================================================
async function cleanupScoped(dataSource: DataSource): Promise<void> {
  const like = `${E2E_PREFIX}%`;

  await dataSource.query(
    `DELETE FROM "movimientos" WHERE "caja_id" IN (
       SELECT "id" FROM "cajas" WHERE "nombre" LIKE $1
     ) OR "responsable_id" IN (
       SELECT "id" FROM "personas" WHERE "nombre" LIKE $1
     )`,
    [like],
  );
  await dataSource.query(`DELETE FROM "cajas" WHERE "nombre" LIKE $1`, [like]);
  await dataSource.query(`DELETE FROM "personas" WHERE "nombre" LIKE $1`, [
    like,
  ]);
}
