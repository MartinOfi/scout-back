/**
 * E2E coverage for GET /api/v1/backups/download
 *
 * Covers:
 * 1. Unauthenticated request → 401.
 * 2. Authenticated request → 200 with gzipped SQL data dump containing
 *    BEGIN/COMMIT and the expected INSERT headers for exported tables.
 * 3. Response headers announce attachment and gzip content type.
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
import { gunzipSync } from 'zlib';

import { AppModule } from '../src/app.module';
import { Persona } from '../src/modules/personas/entities/persona.entity';
import { EstadoPersona, PersonaType } from '../src/common/enums';

const API_PREFIX = '/api/v1';
const AUTH_USER_NAME = 'E2EBackupsAuthUser';

jest.setTimeout(60_000);

describe('Backups > download (e2e)', () => {
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
      .get(`${API_PREFIX}/backups/download`)
      .expect(401);
  });

  it('streams a gzipped SQL data dump for authenticated requests', async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/backups/download`)
      .set('Authorization', `Bearer ${authToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers['content-type']).toMatch(/application\/gzip/);
    expect(response.headers['content-disposition']).toMatch(
      /attachment; filename="scout-backup-\d{8}-\d{6}\.sql\.gz"/,
    );

    const body = response.body as Buffer;
    expect(body.length).toBeGreaterThan(0);

    const decompressed = gunzipSync(body).toString('utf8');
    expect(decompressed).toMatch(/-- Scout database data export/i);
    expect(decompressed).toMatch(/BEGIN;/);
    expect(decompressed).toMatch(/COMMIT;/);
    expect(decompressed).toMatch(/SET session_replication_role = replica;/);
    expect(decompressed).not.toMatch(/refresh_tokens/);
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
  const email = `e2e-backups-auth-${Date.now()}@example.com`;
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
