/**
 * E2E coverage for GET /api/v1/exports/xlsx
 *
 * Covers:
 * 1. Unauthenticated request → 401.
 * 2. Authenticated request → 200 with a valid XLSX file.
 * 3. The XLSX contains all 10 expected sheets with their headers.
 *
 * Pre-requisites
 * --------------
 * - Test database running (`npm run db:test:start`).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { AppModule } from '../src/app.module';
import { Persona } from '../src/modules/personas/entities/persona.entity';
import { EstadoPersona, PersonaType } from '../src/common/enums';

const API_PREFIX = '/api/v1';
const AUTH_USER_NAME = 'E2EExportsAuthUser';

const EXPECTED_SHEETS = [
  'Personas',
  'Cajas',
  'Movimientos',
  'Inscripciones',
  'Cuotas',
  'Campamentos',
  'CampamentoParticipantes',
  'Eventos',
  'Productos',
  'VentasProductos',
];

jest.setTimeout(60_000);

describe('Exports > xlsx (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
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
    authToken = await ensureAuthUserAndGetToken(app, dataSource);
  });

  afterAll(async () => {
    await cleanupAuthUser(dataSource);
    await app.close();
  });

  it('rejects unauthenticated requests with 401', async () => {
    await request(app.getHttpServer())
      .get(`${API_PREFIX}/exports/xlsx`)
      .expect(401);
  });

  it('returns a valid XLSX with all expected sheets', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/exports/xlsx`)
      .set('Authorization', `Bearer ${authToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers['content-type']).toMatch(
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
    expect(response.headers['content-disposition']).toMatch(
      /attachment; filename="scout-export-\d{8}-\d{6}\.xlsx"/,
    );

    const body = response.body as Buffer;
    expect(body.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(body as unknown as ArrayBuffer);

    const sheetNames = workbook.worksheets.map((ws) => ws.name);
    for (const expected of EXPECTED_SHEETS) {
      expect(sheetNames).toContain(expected);
    }

    for (const sheetName of EXPECTED_SHEETS) {
      const ws = workbook.getWorksheet(sheetName);
      expect(ws).toBeDefined();
      const headerRow = ws?.getRow(1);
      expect(headerRow?.font?.bold).toBe(true);
      const firstHeaderCell = headerRow?.getCell(1).value;
      expect(
        typeof firstHeaderCell === 'string' && firstHeaderCell.length > 0,
      ).toBe(true);
    }
  });
});

// ============================================================================
// Test fixtures and helpers
// ============================================================================

async function ensureAuthUserAndGetToken(
  app: INestApplication<App>,
  dataSource: DataSource,
): Promise<string> {
  const personaRepo = dataSource.getRepository(Persona);
  const email = `e2e-exports-auth-${Date.now()}@example.com`;
  const password = 'Password123!';

  await cleanupAuthUser(dataSource);

  const educador = await personaRepo.save(
    personaRepo.create({
      nombre: AUTH_USER_NAME,
      tipo: PersonaType.EDUCADOR,
      estado: EstadoPersona.ACTIVO,
      email: null,
      passwordHash: null,
    } as Partial<Persona>),
  );

  const response = await request(app.getHttpServer())
    .post(`${API_PREFIX}/auth/register`)
    .send({ personaId: educador.id, email, password })
    .expect(201);

  const body = response.body as { accessToken?: string };
  if (!body.accessToken) {
    throw new Error('Auth register did not return accessToken');
  }
  return body.accessToken;
}

async function cleanupAuthUser(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `DELETE FROM refresh_tokens WHERE persona_id IN (SELECT id FROM personas WHERE nombre = $1)`,
    [AUTH_USER_NAME],
  );
  await dataSource.query(`DELETE FROM personas WHERE nombre = $1`, [
    AUTH_USER_NAME,
  ]);
}
