import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Persona } from '../src/modules/personas/entities/persona.entity';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { PersonaType, EstadoPersona } from '../src/common/enums';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let testPersona: Persona;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Match main.ts configuration
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.setGlobalPrefix('api/v1');

    await app.init();

    dataSource = moduleFixture.get(DataSource);
  });

  beforeEach(async () => {
    // Clean up auth-related data using query builder (delete({}) not allowed with empty criteria)
    await dataSource
      .getRepository(RefreshToken)
      .createQueryBuilder()
      .delete()
      .execute();

    // Create a test persona without credentials
    const personaRepo = dataSource.getRepository(Persona);

    // Delete any existing test persona using query builder
    await personaRepo
      .createQueryBuilder()
      .delete()
      .where('nombre = :nombre', { nombre: 'Test E2E User' })
      .execute();

    testPersona = personaRepo.create({
      nombre: 'Test E2E User',
      tipo: PersonaType.EDUCADOR,
      estado: EstadoPersona.ACTIVO,
      email: null,
      passwordHash: null,
    });
    testPersona = await personaRepo.save(testPersona);
  });

  afterAll(async () => {
    // Clean up using query builders
    await dataSource
      .getRepository(RefreshToken)
      .createQueryBuilder()
      .delete()
      .execute();
    await dataSource
      .getRepository(Persona)
      .createQueryBuilder()
      .delete()
      .where('nombre = :nombre', { nombre: 'Test E2E User' })
      .execute();
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register credentials for existing persona', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: testPersona.id,
          email: 'test-e2e@example.com',
          password: 'Password123!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user).toMatchObject({
        id: testPersona.id,
        email: 'test-e2e@example.com',
        nombre: 'Test E2E User',
      });
    });

    it('should return 404 for non-existent persona', async () => {
      // Use a valid UUID v4 format that doesn't exist in the database
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(404);
    });

    it('should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: testPersona.id,
          email: 'invalid-email',
          password: 'Password123!',
        })
        .expect(400);
    });

    it('should return 400 for weak password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: testPersona.id,
          email: 'test@example.com',
          password: '123',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Register credentials first
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        personaId: testPersona.id,
        email: 'login-test@example.com',
        password: 'Password123!',
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe('login-test@example.com');
    });

    it('should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'WrongPassword!',
        })
        .expect(401);
    });

    it('should return 401 for non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and get tokens
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: testPersona.id,
          email: 'refresh-test@example.com',
          password: 'Password123!',
        });

      refreshToken = response.body.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      // New refresh token should be different (rotation)
      expect(response.body.refreshToken).not.toBe(refreshToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should return 401 when using revoked refresh token', async () => {
      // First refresh - should work
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Second refresh with same token - should fail (token was rotated/revoked)
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Register and get tokens
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: testPersona.id,
          email: 'logout-test@example.com',
          password: 'Password123!',
        });

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should logout with valid access token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204);

      // Refresh token should be revoked
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should return 401 without access token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(401);
    });

    it('should return 401 with invalid access token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer invalid-token')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('Protected routes', () => {
    it('should return 401 for protected routes without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/personas').expect(401);
    });

    it('should access protected routes with valid token', async () => {
      // Register and get token
      const authResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: testPersona.id,
          email: 'protected-test@example.com',
          password: 'Password123!',
        });

      const accessToken = authResponse.body.accessToken;

      // Access protected route
      const response = await request(app.getHttpServer())
        .get('/api/v1/personas')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Register and get token
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: testPersona.id,
          email: 'me-test@example.com',
          password: 'Password123!',
        });

      accessToken = response.body.accessToken;
    });

    it('should return current user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: testPersona.id,
        nombre: 'Test E2E User',
        email: 'me-test@example.com',
        tipo: PersonaType.EDUCADOR,
      });
    });

    it('should return 401 without access token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('should return 401 with invalid access token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/auth/password', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Register and get tokens
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          personaId: testPersona.id,
          email: 'password-test@example.com',
          password: 'Password123!',
        });

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should change password successfully', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword456!',
        })
        .expect(204);

      // Verify new password works
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'password-test@example.com',
          password: 'NewPassword456!',
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');
    });

    it('should invalidate old password after change', async () => {
      // Change password
      await request(app.getHttpServer())
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword456!',
        })
        .expect(204);

      // Try to login with old password
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'password-test@example.com',
          password: 'Password123!',
        })
        .expect(401);
    });

    it('should revoke refresh tokens after password change', async () => {
      // Change password
      await request(app.getHttpServer())
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword456!',
        })
        .expect(204);

      // Try to use old refresh token
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should return 401 for wrong current password', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPassword456!',
        })
        .expect(401);
    });

    it('should return 400 when new password is same as current', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'Password123!',
        })
        .expect(400);
    });

    it('should return 400 for password too short', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'short',
        })
        .expect(400);
    });

    it('should return 401 without access token', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/auth/password')
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword456!',
        })
        .expect(401);
    });
  });
});
