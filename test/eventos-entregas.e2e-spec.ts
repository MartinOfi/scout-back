/**
 * E2E coverage for the entregas (product pickup) flow.
 *
 * Pre-requisites
 * --------------
 * - Test database running (`npm run db:test:start`)
 * - Migrations applied — including 1779984000000-CreateEntregas.
 *
 * Coverage
 * --------
 * 1. POST entrega happy path with a single product.
 * 2. POST entrega with multiple products in one pickup.
 * 3. POST returns 400 when stock disponible is insufficient.
 * 4. POST returns 400 when vendedor has no ventas of the product.
 * 5. POST returns 400 when producto does not belong to the evento.
 * 6. POST returns 400 when evento is closed.
 * 7. POST returns 400 when items contain a duplicated productoId.
 * 8. GET stock-disponible reflects ventas minus entregas.
 * 9. GET ?vendedor=<name> filter narrows the stock report.
 * 10. DELETE entrega frees the stock back.
 * 11. DELETE twice → 204 then 409 (already deleted).
 * 12. DELETE entrega from a different evento → 404 (no cross-evento leak).
 * 13. DELETE venta with an active entrega → 409 (blocked).
 * 14. DELETE evento cascades soft-delete to entregas and their lines.
 *
 * Cleanup blast radius
 * --------------------
 * All fixtures are prefixed with `E2EEntregas`. Cleanup only deletes rows
 * matching that prefix; never an unconditional DELETE FROM.
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
import { Entrega } from '../src/modules/eventos/entities/entrega.entity';
import { EntregaLinea } from '../src/modules/eventos/entities/entrega-linea.entity';
import {
  CajaType,
  DestinoGanancia,
  EstadoPersona,
  MedioPago,
  PersonaType,
  Rama,
  TipoEvento,
} from '../src/common/enums';

const API_PREFIX = '/api/v1';
const E2E_PREFIX = 'E2EEntregas';
const VENDEDOR_PREFIX = 'E2EEntregasVendedor';

describe('Eventos > Entregas (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

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
    await cleanupForEntregaTests(dataSource);
    await ensureCajaGrupo(dataSource);
    vendedor = await createVendedor(dataSource);
  });

  // ==========================================================================
  // 1. Happy path
  // ==========================================================================
  it('registers a single-product entrega', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await registrarVenta(app, evento.id, producto.id, vendedor.id, 10);

    const res = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        notas: 'Retiró María 18:30',
        items: [{ productoId: producto.id, cantidad: 4 }],
      })
      .expect(201);

    expect(res.body.lineas).toHaveLength(1);
    expect(res.body.lineas[0].cantidad).toBe(4);
    expect(res.body.notas).toBe('Retiró María 18:30');
    expect(res.body.vendedorNombre).toContain(VENDEDOR_PREFIX);
  });

  // ==========================================================================
  // 2. Multi-product entrega
  // ==========================================================================
  it('registers a multi-product entrega in a single transaction', async () => {
    const evento = await createEventoVenta(dataSource);
    const locro = await createProducto(dataSource, evento.id, {
      nombre: `${E2E_PREFIX}-Locro`,
    });
    const empanada = await createProducto(dataSource, evento.id, {
      nombre: `${E2E_PREFIX}-Empanada`,
    });
    await registrarVenta(app, evento.id, locro.id, vendedor.id, 10);
    await registrarVenta(app, evento.id, empanada.id, vendedor.id, 5);

    const res = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [
          { productoId: locro.id, cantidad: 3 },
          { productoId: empanada.id, cantidad: 2 },
        ],
      })
      .expect(201);

    expect(res.body.lineas).toHaveLength(2);
  });

  // ==========================================================================
  // 3. Stock insufficient
  // ==========================================================================
  it('returns 400 when cantidad exceeds stock disponible', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await registrarVenta(app, evento.id, producto.id, vendedor.id, 5);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 6 }],
      })
      .expect(400);
  });

  // ==========================================================================
  // 4. Vendedor sin ventas del producto
  // ==========================================================================
  it('returns 400 when vendedor has no ventas of the product', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    // No registramos ventas: el vendedor no tiene stock de ese producto

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 1 }],
      })
      .expect(400);
  });

  // ==========================================================================
  // 5. Producto ajeno al evento
  // ==========================================================================
  it('returns 400 when productoId does not belong to the evento', async () => {
    const evento1 = await createEventoVenta(dataSource);
    const evento2 = await createEventoVenta(dataSource, {
      nombre: `${E2E_PREFIX}-Evento2-${Date.now()}`,
    });
    const productoAjeno = await createProducto(dataSource, evento2.id);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento1.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: productoAjeno.id, cantidad: 1 }],
      })
      .expect(400);
  });

  // ==========================================================================
  // 6. Evento cerrado
  // ==========================================================================
  it('returns 400 when the evento is closed', async () => {
    const evento = await createEventoVenta(dataSource, { estaCerrado: true });
    const producto = await createProducto(dataSource, evento.id);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 1 }],
      })
      .expect(400);
  });

  // ==========================================================================
  // 7. Items duplicados
  // ==========================================================================
  it('returns 400 when items contain a duplicated productoId', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await registrarVenta(app, evento.id, producto.id, vendedor.id, 10);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [
          { productoId: producto.id, cantidad: 1 },
          { productoId: producto.id, cantidad: 2 },
        ],
      })
      .expect(400);
  });

  // ==========================================================================
  // 8. Stock disponible reflects ventas - entregas
  // ==========================================================================
  it('returns vendida/entregada/disponible in stock-disponible', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await registrarVenta(app, evento.id, producto.id, vendedor.id, 10);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 4 }],
      })
      .expect(201);

    const stockRes = await request(app.getHttpServer())
      .get(`${API_PREFIX}/eventos/${evento.id}/entregas/stock-disponible`)
      .expect(200);

    const row = stockRes.body.find(
      (r: { vendedorId: string }) => r.vendedorId === vendedor.id,
    );
    expect(row.cantidadVendida).toBe(10);
    expect(row.cantidadEntregada).toBe(4);
    expect(row.cantidadDisponible).toBe(6);
  });

  // ==========================================================================
  // 9. Stock filtered by vendedor name
  // ==========================================================================
  it('filters stock-disponible by vendedor name (case-insensitive)', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await registrarVenta(app, evento.id, producto.id, vendedor.id, 5);
    const otroVendedor = await createVendedor(dataSource);
    await registrarVenta(app, evento.id, producto.id, otroVendedor.id, 5);

    const stockRes = await request(app.getHttpServer())
      .get(`${API_PREFIX}/eventos/${evento.id}/entregas/stock-disponible`)
      .query({ vendedor: VENDEDOR_PREFIX.toLowerCase() })
      .expect(200);

    expect(stockRes.body.length).toBeGreaterThanOrEqual(2);
  });

  // ==========================================================================
  // 10. DELETE entrega restores stock
  // ==========================================================================
  it('DELETE entrega frees the stock back', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await registrarVenta(app, evento.id, producto.id, vendedor.id, 10);

    const createRes = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 4 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `${API_PREFIX}/eventos/${evento.id}/entregas/${createRes.body.id}`,
      )
      .expect(204);

    const stockRes = await request(app.getHttpServer())
      .get(`${API_PREFIX}/eventos/${evento.id}/entregas/stock-disponible`)
      .expect(200);
    const row = stockRes.body.find(
      (r: { vendedorId: string }) => r.vendedorId === vendedor.id,
    );
    expect(row.cantidadEntregada).toBe(0);
    expect(row.cantidadDisponible).toBe(10);
  });

  // ==========================================================================
  // 11. Idempotency boundary
  // ==========================================================================
  it('first delete succeeds, second returns 409 (already deleted)', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await registrarVenta(app, evento.id, producto.id, vendedor.id, 5);

    const createRes = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 2 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `${API_PREFIX}/eventos/${evento.id}/entregas/${createRes.body.id}`,
      )
      .expect(204);

    await request(app.getHttpServer())
      .delete(
        `${API_PREFIX}/eventos/${evento.id}/entregas/${createRes.body.id}`,
      )
      .expect(409);
  });

  // ==========================================================================
  // 12. Cross-evento leak prevention
  // ==========================================================================
  it('returns 404 when the entrega does not belong to the supplied evento', async () => {
    const evento1 = await createEventoVenta(dataSource);
    const evento2 = await createEventoVenta(dataSource, {
      nombre: `${E2E_PREFIX}-Otro-${Date.now()}`,
    });
    const producto = await createProducto(dataSource, evento1.id);
    await registrarVenta(app, evento1.id, producto.id, vendedor.id, 5);

    const createRes = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento1.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 2 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(
        `${API_PREFIX}/eventos/${evento2.id}/entregas/${createRes.body.id}`,
      )
      .expect(404);
  });

  // ==========================================================================
  // 13. Block venta delete when entregas exist
  // ==========================================================================
  it('returns 409 when trying to delete a venta that has live entregas', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);

    const ventaRes = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/ventas`)
      .send({
        productoId: producto.id,
        vendedorId: vendedor.id,
        cantidad: 5,
        medioPago: MedioPago.EFECTIVO,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 2 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}/ventas/${ventaRes.body.id}`)
      .expect(409);
  });

  // ==========================================================================
  // 14. Cascade on evento delete
  // ==========================================================================
  it('soft-deletes entregas + lines when the evento is deleted', async () => {
    const evento = await createEventoVenta(dataSource);
    const producto = await createProducto(dataSource, evento.id);
    await registrarVenta(app, evento.id, producto.id, vendedor.id, 5);

    const createRes = await request(app.getHttpServer())
      .post(`${API_PREFIX}/eventos/${evento.id}/entregas`)
      .send({
        vendedorId: vendedor.id,
        items: [{ productoId: producto.id, cantidad: 2 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`${API_PREFIX}/eventos/${evento.id}`)
      .expect(200);

    const entregaRow = await dataSource
      .getRepository(Entrega)
      .createQueryBuilder('e')
      .where('e.id = :id', { id: createRes.body.id })
      .withDeleted()
      .getOne();
    expect(entregaRow?.deletedAt).not.toBeNull();

    const liveLineas = await dataSource
      .getRepository(EntregaLinea)
      .count({ where: { entregaId: createRes.body.id } });
    expect(liveLineas).toBe(0);
  });
});

// ============================================================================
// Test fixtures and helpers
// ============================================================================

async function cleanupForEntregaTests(dataSource: DataSource): Promise<void> {
  // 1. entregas_lineas: solo las cuyas cabeceras son de eventos de test
  await dataSource.query(
    `DELETE FROM entregas_lineas
      WHERE entrega_id IN (
        SELECT id FROM entregas
         WHERE evento_id IN (
           SELECT id FROM eventos WHERE nombre LIKE $1
         )
      )`,
    [`${E2E_PREFIX}%`],
  );

  // 2. entregas de eventos de test
  await dataSource.query(
    `DELETE FROM entregas
      WHERE evento_id IN (
        SELECT id FROM eventos WHERE nombre LIKE $1
      )`,
    [`${E2E_PREFIX}%`],
  );

  // 3. ventas_productos de eventos de test
  await dataSource.query(
    `DELETE FROM ventas_productos
      WHERE evento_id IN (
        SELECT id FROM eventos WHERE nombre LIKE $1
      )`,
    [`${E2E_PREFIX}%`],
  );

  // 4. movimientos ligados a eventos / personas de test
  await dataSource.query(
    `DELETE FROM movimientos
      WHERE evento_id IN (
        SELECT id FROM eventos WHERE nombre LIKE $1
      )
         OR responsable_id IN (
           SELECT id FROM personas WHERE nombre LIKE $2
         )`,
    [`${E2E_PREFIX}%`, `${VENDEDOR_PREFIX}%`],
  );

  // 5. productos de eventos de test
  await dataSource.query(
    `DELETE FROM productos
      WHERE evento_id IN (
        SELECT id FROM eventos WHERE nombre LIKE $1
      )`,
    [`${E2E_PREFIX}%`],
  );

  // 6. eventos de test
  await dataSource.query(`DELETE FROM eventos WHERE nombre LIKE $1`, [
    `${E2E_PREFIX}%`,
  ]);

  // 7. personas de test (vendedores)
  await dataSource.query(`DELETE FROM personas WHERE nombre LIKE $1`, [
    `${VENDEDOR_PREFIX}%`,
  ]);
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
    nombre: `${VENDEDOR_PREFIX}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
    nombre: `${E2E_PREFIX}-Evento-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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

async function registrarVenta(
  app: INestApplication<App>,
  eventoId: string,
  productoId: string,
  vendedorId: string,
  cantidad: number,
): Promise<VentaProducto> {
  const res = await request(app.getHttpServer())
    .post(`${API_PREFIX}/eventos/${eventoId}/ventas`)
    .send({
      productoId,
      vendedorId,
      cantidad,
      medioPago: MedioPago.EFECTIVO,
    })
    .expect(201);
  return res.body as VentaProducto;
}
