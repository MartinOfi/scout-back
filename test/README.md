# Test Infrastructure

## ⚠️ SAFETY RULES (NON-NEGOTIABLE)

Before adding or modifying anything in this directory, read this section.

### Rule 1 — No bulk `DELETE` / `TRUNCATE`

**NUNCA** usar `DELETE FROM <tabla>` sin `WHERE`, ni `TRUNCATE TABLE`, ni
`dropSchema: true`, ni nada que pueda vaciar una tabla completa.

**Por qué:** la configuración del proyecto hace que `AppModule` cargue
`.env.local` hardcodeado (ver `src/app.module.ts`), por lo que cualquier
test e2e que importe `AppModule` se conecta a la base apuntada por
`.env.local` — que **no** es la de testing en Docker. Un `DELETE FROM
movimientos` en un helper de test llegó a destruir datos reales de
desarrollo/staging en Neon en el pasado (ver `docs/superpowers/` o el
historial de incidentes).

### Rule 2 — Todo dato de test debe ser prefix-scoped

Cuando un test crea datos, **todo** lo que inserta debe llevar un prefijo
único e identificable (`E2EVentasDelete-`, `E2EBaja-`, `E2EVendedor-`,
etc.). La cleanup **siempre** filtra por ese prefijo usando `WHERE ... LIKE
'Prefijo%'` o subconsultas con joins sobre personas/eventos/cajas
prefijadas.

Invariante a mantener: **si un test corre accidentalmente contra una base
de datos real, solo debe poder afectar filas con su propio prefijo — cero
blast radius.**

### Rule 3 — Cleanup respeta el orden de FKs

En un mismo helper de cleanup, borrar primero las filas hijo (que
referencian) y después las padre. El orden típico:
`ventas_productos → movimientos → productos → eventos → personas`.

### Rule 4 — Si necesitás utilidades de cleanup "genéricas" para un nuevo suite, inline-las en el propio spec

No recrear un módulo `helpers/database-cleaner.ts` u otro archivo
genérico. La tentación de "abstraer el cleanup" es exactamente lo que
llevó al incidente anterior — quedó un arsenal de funciones destructivas
en un archivo huérfano que nadie recordaba, importado solo por un script
manual. Si el cleanup vive dentro del `.e2e-spec.ts` al que pertenece, su
radio de reuso está limitado y su scope es auditable en un único lugar.

---

## Overview

Este directorio contiene los tests end-to-end (e2e) del backend Scout. Los
tests usan Jest + Supertest + NestJS Testing Module, y se conectan a una
base de PostgreSQL separada a través de Docker.

## Getting Started

### 1. Start Test Database

```bash
npm run db:test:start
```

Arranca un container PostgreSQL 15 en puerto 5433 (para no chocar con
PostgreSQL local en 5432).

### 2. Run Tests

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Watch mode
npm run test:e2e:watch

# Coverage
npm run test:cov
```

### 3. Stop Test Database

```bash
npm run db:test:stop
```

### 4. Reset Test Database

Si necesitás arrancar de cero:

```bash
npm run db:test:reset
```

Esto destruye el container y sus volúmenes, luego los recrea.

## File Structure

```
test/
├── app.e2e-spec.ts                     # App bootstrap smoke test
├── auth.e2e-spec.ts                    # Auth flow e2e
├── eventos-ventas-delete.e2e-spec.ts   # Eventos > venta delete e2e
├── personas-baja.e2e-spec.ts           # Personas > dar-de-baja e2e
├── jest-e2e.json                       # Jest config for e2e
└── README.md                           # This file
```

## Writing a new e2e test — pattern

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

const API_PREFIX = '/api/v1';
const E2E_PREFIX = 'E2EMiFeature'; // ← único por suite, lo usás en cleanup

describe('Mi Feature (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

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
    await cleanupScoped(dataSource);
  });

  it('...', async () => {
    // crear datos con el prefijo: nombre: `${E2E_PREFIX}-${Date.now()}`
    // usar request(app.getHttpServer()) para golpear endpoints
  });
});

// ============================================================================
// Cleanup: SIEMPRE scoped por prefijo. Jamás DELETE FROM <tabla> sin WHERE.
// ============================================================================
async function cleanupScoped(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `DELETE FROM movimientos WHERE responsable_id IN (
       SELECT id FROM personas WHERE nombre LIKE $1
     )`,
    [`${E2E_PREFIX}%`],
  );
  await dataSource.query(
    `DELETE FROM personas WHERE nombre LIKE $1`,
    [`${E2E_PREFIX}%`],
  );
}
```

Ver `test/personas-baja.e2e-spec.ts` y `test/eventos-ventas-delete.e2e-spec.ts`
para ejemplos concretos.
