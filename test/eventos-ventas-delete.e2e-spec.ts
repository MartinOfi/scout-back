/**
 * E2E coverage for the venta delete flow.
 *
 * Pre-requisites
 * --------------
 * - Test database running (`npm run db:test:start`)
 * - Migrations applied (the new `movimiento_id` and `esta_cerrado` columns
 *   come from migrations 1713000000000 and 1713000001000).
 *
 * What we cover
 * -------------
 * 1. DELETE individual venta -> 200, KPI ganancia drops to zero, movimiento
 *    is also soft-deleted.
 * 2. DELETE venta that belongs to a lote -> 200, all sibling ventas of the
 *    same lote are soft-deleted, the aggregated movimiento is gone too,
 *    and the response reports `hermanasEliminadas`.
 * 3. DELETE on a closed evento -> 400.
 * 4. DELETE with mismatched eventoId/ventaId -> 404 (no cross-evento leak).
 * 5. DELETE the same venta twice -> 200 then 409 (idempotency boundary).
 * 6. DELETE evento whose only movements are venta-derived -> 200 (cascade).
 * 7. DELETE evento with a manual ingreso/gasto attached -> 409.
 *
 * Auth
 * ----
 * The new DELETE endpoint does NOT require @CurrentUser. Manual ingreso/gasto
 * registration DOES (via the existing endpoints) — for the manual-movement
 * scenarios we insert the movimiento via the repository directly to keep
 * the test focused on delete semantics, not on auth.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Persona } from '../src/modules/personas/entities/persona.entity';
import { Caja } from '../src/modules/cajas/entities/caja.entity';
import { Evento } from '../src/modules/eventos/entities/evento.entity';
import { Producto } from '../src/modules/eventos/entities/producto.entity';
import { VentaProducto } from '../src/modules/eventos/entities/venta-producto.entity';
import { Movimiento } from '../src/modules/movimientos/entities/movimiento.entity';
import {
  CajaType,
  ConceptoMovimiento,
  DestinoGanancia,
  EstadoPago,
  EstadoPersona,
  MedioPago,
  PersonaType,
  Rama,
  TipoEvento,
  TipoMovimiento,
} from '../src/common/enums';

const API_PREFIX = '/api/v1';

describe('Eventos > Delete Venta (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  // Shared test entities reused across the suite
  let cajaGrupo: Caja;
  let vendedor: Persona;

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanupForVentaTests(dataSource);
    cajaGrupo = await ensureCajaGrupo(dataSource);
    vendedor = await createVendedor(dataSource);
  });

  // ==========================================================================
  // 1. Individual venta delete
  // ==========================================================================
  it('deletes an individual venta and its associated movimiento (KPIs back to zero)', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);

    // Register a venta via the public endpoint so the new transactional path
    // creates and links the movimiento.
    const registerRes = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/ventas`)
      .send({
        productoId: producto.id,
        vendedorId: vendedor.id,
        cantidad: 4,
        medioPago: MedioPago.EFECTIVO,
      })
      .expect(201);

    const ventaId = registerRes.body.id as string;
    expect(registerRes.body.movimientoId).toBeTruthy();

    const kpisBefore = await request(app.getHttpServer())
      .get(`${API_PREFIX}/eventos/${evento.id}/kpis`)
      .expect(200);
    expect(kpisBefore.body.gananciaVentas).toBeGreaterThan(0);

    const deleteRes = await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}/ventas/${ventaId}`)
      .expect(200);

    expect(deleteRes.body).toEqual({
      ventaId,
      movimientoIdEliminado: registerRes.body.movimientoId,
      hermanasEliminadas: 0,
    });

    const kpisAfter = await request(app.getHttpServer())
      .get(`${API_PREFIX}/eventos/${evento.id}/kpis`)
      .expect(200);
    expect(kpisAfter.body.gananciaVentas).toBe(0);

    // Movimiento is soft-deleted
    const movimientoRow = await dataSource
      .getRepository(Movimiento)
      .createQueryBuilder('m')
      .where('m.id = :id', { id: registerRes.body.movimientoId })
      .withDeleted()
      .getOne();
    expect(movimientoRow?.deletedAt).not.toBeNull();
  });

  // ==========================================================================
  // 2. Lote cascade
  // ==========================================================================
  it('deletes a lote venta and cascades to siblings + aggregated movimiento', async () => {
    const evento = await createEventoVenta(dataSource);
    const productoA = await createProducto(dataSource, evento.id);
    const productoB = await createProducto(dataSource, evento.id, {
      nombre: 'Producto B',
    });

    const loteRes = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/ventas/lote`)
      .send({
        vendedorId: vendedor.id,
        medioPago: MedioPago.EFECTIVO,
        items: [
          { productoId: productoA.id, cantidad: 2 },
          { productoId: productoB.id, cantidad: 5 },
        ],
      })
      .expect(201);

    const ventas = loteRes.body as Array<{
      id: string;
      movimientoId: string;
    }>;
    expect(ventas).toHaveLength(2);
    const movimientoCompartido = ventas[0].movimientoId;
    expect(ventas[1].movimientoId).toBe(movimientoCompartido);

    const deleteRes = await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}/ventas/${ventas[0].id}`)
      .expect(200);

    expect(deleteRes.body.hermanasEliminadas).toBe(1);
    expect(deleteRes.body.movimientoIdEliminado).toBe(movimientoCompartido);

    // Both ventas soft-deleted
    const liveVentas = await dataSource
      .getRepository(VentaProducto)
      .find({ where: { eventoId: evento.id } });
    expect(liveVentas).toHaveLength(0);

    // Movimiento soft-deleted
    const movRow = await dataSource
      .getRepository(Movimiento)
      .createQueryBuilder('m')
      .where('m.id = :id', { id: movimientoCompartido })
      .withDeleted()
      .getOne();
    expect(movRow?.deletedAt).not.toBeNull();
  });

  // ==========================================================================
  // 3. Closed event blocks delete
  // ==========================================================================
  it('returns 400 when the evento is closed', async () => {
    const evento = await createEventoVenta(dataSource, { estaCerrado: true });
    // Insert a venta directly to bypass the registrar endpoint (which would
    // also fail on a closed event once that path enforces the same rule).
    const venta = await dataSource.getRepository(VentaProducto).save({
      eventoId: evento.id,
      productoId: (await createProducto(dataSource, evento.id)).id,
      vendedorId: vendedor.id,
      cantidad: 1,
    } as Partial<VentaProducto>);

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}/ventas/${venta.id}`)
      .expect(400);
  });

  // ==========================================================================
  // 4. Mismatched eventoId / ventaId -> 404 (no cross-evento leak)
  // ==========================================================================
  it('returns 404 when the venta does not belong to the supplied evento', async () => {
    const evento1 = await createEventoVenta(dataSource);
    const evento2 = await createEventoVenta(dataSource, { nombre: 'Otro' });
    const producto = await createProducto(dataSource, evento1.id);
    const venta = await dataSource.getRepository(VentaProducto).save({
      eventoId: evento1.id,
      productoId: producto.id,
      vendedorId: vendedor.id,
      cantidad: 1,
    } as Partial<VentaProducto>);

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento2.id}/ventas/${venta.id}`)
      .expect(404);
  });

  // ==========================================================================
  // 5. Idempotency boundary
  // ==========================================================================
  it('first delete succeeds, second one returns 409 (already deleted)', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    const registerRes = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/ventas`)
      .send({
        productoId: producto.id,
        vendedorId: vendedor.id,
        cantidad: 1,
        medioPago: MedioPago.EFECTIVO,
      })
      .expect(201);
    const ventaId = registerRes.body.id as string;

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}/ventas/${ventaId}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}/ventas/${ventaId}`)
      .expect(409);
  });

  // ==========================================================================
  // 6. DELETE evento with only venta-derived movements
  // ==========================================================================
  it('deletes the whole evento and cascades movimientos when no manual ones exist', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/ventas`)
      .send({
        productoId: producto.id,
        vendedorId: vendedor.id,
        cantidad: 2,
        medioPago: MedioPago.EFECTIVO,
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}`)
      .expect(200);

    const eventoRow = await dataSource
      .getRepository(Evento)
      .createQueryBuilder('e')
      .where('e.id = :id', { id: evento.id })
      .withDeleted()
      .getOne();
    expect(eventoRow?.deletedAt).not.toBeNull();

    // No live movimientos for this evento
    const liveMovs = await dataSource
      .getRepository(Movimiento)
      .count({ where: { eventoId: evento.id } });
    expect(liveMovs).toBe(0);
  });

  // ==========================================================================
  // 7. DELETE evento with manual ingreso -> 400/409
  // ==========================================================================
  it('refuses to delete an evento that has a manual ingreso/gasto', async () => {
    const evento = await createEventoVenta(dataSource);

    // Insert a manual ingreso directly so it has no associated venta. This
    // simulates the "external" movimiento case the validator must block.
    await dataSource.getRepository(Movimiento).save({
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.INGRESO,
      monto: 1000,
      concepto: ConceptoMovimiento.EVENTO_GRUPO_INGRESO,
      descripcion: 'Ingreso manual',
      responsableId: vendedor.id,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PAGADO,
      eventoId: evento.id,
      fecha: new Date(),
    } as Partial<Movimiento>);

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}`)
      .expect((res) => {
        if (![400, 409].includes(res.status)) {
          throw new Error(`Expected 400/409, got ${res.status}`);
        }
      });
  });
});

// ============================================================================
// Test fixtures and helpers
// ============================================================================

/**
 * Todos los helpers prefijan los datos creados con `E2EVentasDelete`.
 * La cleanup SOLO borra filas que matchean ese prefijo — NUNCA hace
 * `DELETE FROM <tabla>` sin `WHERE`.
 *
 * Invariante: si esta suite llegara a correr contra una base real, solo
 * afectaría filas con el prefijo de test — cero blast radius sobre datos
 * de usuarios reales.
 */
const E2E_PREFIX = 'E2EVentasDelete';

async function cleanupForVentaTests(dataSource: DataSource): Promise<void> {
  // 1. ventas_productos: solo las que pertenecen a productos de eventos de test
  await dataSource.query(
    `DELETE FROM ventas_productos
      WHERE producto_id IN (
        SELECT id FROM productos
         WHERE evento_id IN (
           SELECT id FROM eventos WHERE nombre LIKE $1
         )
      )`,
    [`${E2E_PREFIX}%`],
  );

  // 2. movimientos: solo los ligados a eventos de test, o a responsables de test
  await dataSource.query(
    `DELETE FROM movimientos
      WHERE evento_id IN (
        SELECT id FROM eventos WHERE nombre LIKE $1
      )
         OR responsable_id IN (
           SELECT id FROM personas WHERE nombre LIKE $2
         )`,
    [`${E2E_PREFIX}%`, 'E2EVendedor%'],
  );

  // 3. productos: solo los de eventos de test
  await dataSource.query(
    `DELETE FROM productos
      WHERE evento_id IN (
        SELECT id FROM eventos WHERE nombre LIKE $1
      )`,
    [`${E2E_PREFIX}%`],
  );

  // 4. eventos de test
  await dataSource.query(`DELETE FROM eventos WHERE nombre LIKE $1`, [
    `${E2E_PREFIX}%`,
  ]);

  // 5. personas de test (vendedores)
  await dataSource.query(`DELETE FROM personas WHERE nombre LIKE $1`, [
    'E2EVendedor%',
  ]);

  // NOTA: no tocamos `cajas`. Esta suite no crea cajas no-grupo, así que
  // no hay nada que limpiar. El `DELETE FROM cajas WHERE tipo NOT IN ('grupo')`
  // anterior barría TODAS las cajas personales/rama reales del sistema.
}

async function ensureCajaGrupo(dataSource: DataSource): Promise<Caja> {
  const repo = dataSource.getRepository(Caja);
  const existing = await repo.findOne({ where: { tipo: CajaType.GRUPO } });
  if (existing) return existing;
  const created = repo.create({
    tipo: CajaType.GRUPO,
    nombre: `${E2E_PREFIX}-CajaGrupo`,
  } as Partial<Caja>);
  return repo.save(created);
}

async function createVendedor(dataSource: DataSource): Promise<Persona> {
  const repo = dataSource.getRepository(Persona);
  const persona = repo.create({
    nombre: `E2EVendedor-${Date.now()}`,
    apellido: 'Test',
    dni: String(Math.floor(10000000 + Math.random() * 89999999)),
    fechaNacimiento: new Date('2010-01-01'),
    tipo: PersonaType.PROTAGONISTA,
    estado: EstadoPersona.ACTIVO,
    rama: Rama.MANADA,
    fechaIngreso: new Date(),
    fueBonificado: false,
  } as Partial<Persona>);
  return repo.save(persona);
}

async function createEventoVenta(
  dataSource: DataSource,
  overrides: Partial<Evento> = {},
): Promise<Evento> {
  const repo = dataSource.getRepository(Evento);
  const evento = repo.create({
    nombre: `${E2E_PREFIX}-Evento-${Date.now()}`,
    fecha: new Date('2026-09-01'),
    tipo: TipoEvento.VENTA,
    destinoGanancia: DestinoGanancia.CAJA_GRUPO,
    estaCerrado: false,
    ...overrides,
  } as Partial<Evento>);
  return repo.save(evento);
}

async function createProducto(
  dataSource: DataSource,
  eventoId: string,
  overrides: Partial<Producto> = {},
): Promise<Producto> {
  const repo = dataSource.getRepository(Producto);
  const producto = repo.create({
    eventoId,
    nombre: `${E2E_PREFIX}-Producto`,
    precioCosto: 500,
    precioVenta: 1000,
    ...overrides,
  } as Partial<Producto>);
  return repo.save(producto);
}
