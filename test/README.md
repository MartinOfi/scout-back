# Test Infrastructure

## Overview

This directory contains the test infrastructure for the Scout backend application, including database setup, cleanup utilities, and data factories for testing.

## Getting Started

### 1. Start Test Database

```bash
npm run db:test:start
```

This starts a PostgreSQL 15 Docker container on port 5433 (to avoid conflicts with local PostgreSQL).

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

If you need a clean slate:

```bash
npm run db:test:reset
```

This destroys the container and volumes, then recreates everything.

## File Structure

```
test/
├── helpers/
│   ├── database-cleaner.ts    # Advanced cleanup utilities
│   └── test-data-factory.ts   # Factory pattern for test data
├── test-setup.ts               # Core test infrastructure
├── verify-test-db.ts          # Verification script (dev only)
└── README.md                   # This file
```

## Test Setup

### Core Functions

#### `setupTestDatabase(): Promise<DataSource>`

Initializes connection to test database using `.env.test` configuration.

```typescript
import { setupTestDatabase } from './test-setup';

const dataSource = await setupTestDatabase();
```

#### `cleanDatabase(): Promise<void>`

Truncates all tables and resets sequences. Safe for use between tests.

```typescript
import { cleanDatabase } from './test-setup';

beforeEach(async () => {
  await cleanDatabase();
});
```

#### `closeTestDatabase(): Promise<void>`

Closes the test database connection. Use in global teardown.

```typescript
import { closeTestDatabase } from './test-setup';

afterAll(async () => {
  await closeTestDatabase();
});
```

## Data Factories

### Overview

Data factories provide convenient methods to create test entities with sensible defaults.

```typescript
import { createTestDataFactory } from './helpers/test-data-factory';

const factory = createTestDataFactory(dataSource);
```

### Available Factories

#### ProtagonistaFactory

```typescript
// Create single protagonista with defaults
const protagonista = await factory.protagonista.create();

// Override defaults
const customProtagonista = await factory.protagonista.create({
  nombre: 'Juan',
  apellido: 'Pérez',
  rama: Rama.UNIDAD,
});

// Create multiple
const protagonistas = await factory.protagonista.createMany(5);
```

#### EducadorFactory

```typescript
const educador = await factory.educador.create({
  nombre: 'Maria',
  rama: Rama.MANADA,
});
```

#### CampamentoFactory

```typescript
const campamento = await factory.campamento.create({
  nombre: 'Campamento de Verano 2026',
  fechaInicio: new Date('2026-01-15'),
  fechaFin: new Date('2026-01-22'),
});
```

#### MovimientoFactory

```typescript
const movimiento = await factory.movimiento.create({
  tipo: TipoMovimiento.INGRESO,
  monto: 5000,
  concepto: ConceptoMovimiento.CUOTA_GRUPO,
});
```

#### EventoFactory

```typescript
const evento = await factory.evento.create({
  nombre: 'Venta de empanadas',
  fecha: new Date('2026-05-10'),
});
```

## Database Cleaner Utilities

For more granular control over database state:

### `truncateTables(dataSource, entityNames)`

Truncate only specific tables:

```typescript
import { truncateTables } from './helpers/database-cleaner';

await truncateTables(dataSource, ['Persona', 'Movimiento']);
```

### `verifyDatabaseIsEmpty(dataSource)`

Verify all tables are empty:

```typescript
import { verifyDatabaseIsEmpty } from './helpers/database-cleaner';

const isEmpty = await verifyDatabaseIsEmpty(dataSource);
if (!isEmpty) {
  console.error('Database is not empty!');
}
```

### `fullDatabaseReset(dataSource)`

Most aggressive cleanup - truncates all tables, resets sequences, and verifies:

```typescript
import { fullDatabaseReset } from './helpers/database-cleaner';

await fullDatabaseReset(dataSource);
```

## Environment Configuration

### `.env.test`

```env
NODE_ENV=test
DATABASE_URL='postgresql://test_user:test_password@localhost:5433/scout_test?schema=public'
JWT_SECRET=test-secret-for-e2e-tests
JWT_EXPIRATION=1h
PORT=3001
LOG_LEVEL=error
```

**Important:**
- Uses port 5433 (not 5432) to avoid conflicts
- Separate database from development (`scout_test`)
- Test credentials are different from production
- Log level set to `error` for clean test output

## Docker Configuration

### `docker-compose.test.yml`

- Image: `postgres:15-alpine`
- Container name: `scout-postgres-test`
- Port: `5433:5432` (external:internal)
- Volume: `postgres_test_data` (persists between runs)
- Performance optimizations for testing:
  - `fsync=off`
  - `synchronous_commit=off`
  - `full_page_writes=off`

**Warning:** These optimizations are safe for test databases but NEVER use in production.

## Example Test Suite

```typescript
import { setupTestDatabase, cleanDatabase, closeTestDatabase } from './test-setup';
import { createTestDataFactory } from './helpers/test-data-factory';
import { DataSource } from 'typeorm';

describe('Protagonistas E2E Tests', () => {
  let dataSource: DataSource;
  let factory: ReturnType<typeof createTestDataFactory>;

  beforeAll(async () => {
    dataSource = await setupTestDatabase();
    factory = createTestDataFactory(dataSource);
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  it('should create a protagonista', async () => {
    const protagonista = await factory.protagonista.create({
      nombre: 'Test',
      apellido: 'User',
    });

    expect(protagonista.id).toBeDefined();
    expect(protagonista.nombre).toBe('Test');
    expect(protagonista.estado).toBe(EstadoPersona.ACTIVO);
  });

  it('should create multiple protagonistas', async () => {
    const protagonistas = await factory.protagonista.createMany(5);

    expect(protagonistas).toHaveLength(5);
    expect(protagonistas[0].rama).toBe(Rama.MANADA);
  });
});
```

## Troubleshooting

### Connection Refused

If you get `ECONNREFUSED` errors:

1. Check Docker container is running:
   ```bash
   docker ps | grep scout-postgres-test
   ```

2. Check container logs:
   ```bash
   npm run db:test:logs
   ```

3. Restart container:
   ```bash
   npm run db:test:reset
   ```

### Port Already in Use

If port 5433 is already in use, edit `docker-compose.test.yml`:

```yaml
ports:
  - "5434:5432"  # Change to 5434 or another free port
```

Then update `.env.test`:

```env
DATABASE_URL='postgresql://test_user:test_password@localhost:5434/scout_test?schema=public'
```

### Enum Value Errors

If you get errors like `invalid input value for enum`:

- Make sure you're using enum constants, not strings:
  ```typescript
  // ✅ Correct
  tipo: PersonaType.PROTAGONISTA,
  estado: EstadoPersona.ACTIVO,

  // ❌ Wrong
  tipo: 'PROTAGONISTA',
  estado: 'ACTIVO',
  ```

### TypeORM Metadata Errors

If you get errors like `Data type "Object" not supported`:

- This happens with optional nullable fields using `?:` syntax
- Fix by using `!:` and explicit column type:
  ```typescript
  // ❌ Wrong
  @Column({ nullable: true })
  field?: string | null;

  // ✅ Correct
  @Column({ type: 'varchar', nullable: true })
  field!: string | null;
  ```

## npm Scripts Reference

```json
{
  "db:test:start": "Start test database",
  "db:test:stop": "Stop test database",
  "db:test:logs": "View database logs",
  "db:test:reset": "Full reset (down + up)",
  "test": "Run unit tests",
  "test:watch": "Unit tests in watch mode",
  "test:cov": "Unit tests with coverage",
  "test:e2e": "Run E2E tests",
  "test:e2e:watch": "E2E tests in watch mode"
}
```

## Next Steps

- [ ] Frontend test utilities (Phase 1.2)
- [ ] Playwright installation (Phase 1.3)
- [ ] Write E2E test suites (Phase 2)
- [ ] CI/CD integration (Phase 5)
