# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Scout** is a NestJS backend for financial management of a scout group. It handles members (protagonistas, educadores), financial accounts (cajas), movements, inscriptions, monthly fees (cuotas), camps, and events.

### Tech Stack

- **Framework:** NestJS 11+, TypeScript 5+
- **Database:** PostgreSQL with TypeORM 0.3+
- **Validation:** class-validator 0.14+, class-transformer
- **Testing:** Jest 30+
- **API Documentation:** Swagger (available at `/api/docs`)
- **API Prefix:** `/api/v1`

## Quick Commands

### Development

```bash
npm run start:dev        # Run in watch mode
npm run start:debug      # Run with debugger
npm run build            # Compile TypeScript
npm run lint             # ESLint with auto-fix
npm run format           # Prettier formatting
```

### Testing

```bash
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:cov         # Generate coverage report
npm run test:debug       # Debug single test
npm run test:e2e         # Run E2E tests
npm run test:e2e:watch   # Run E2E tests in watch mode
```

### Database (Docker)

```bash
npm run db:test:start    # Start test database
npm run db:test:stop     # Stop test database
npm run db:test:logs     # View database logs
npm run db:test:reset    # Reset test database (drop volumes)
docker-compose up -d     # Start development database
docker-compose down      # Stop development database
```

## Project Architecture

### Module Structure

```
src/
├── app.module.ts          # Root module with all imports
├── main.ts                # App bootstrap (CORS, pipes, Swagger)
├── common/                # Shared utilities
│   ├── entities/          # BaseEntity (UUID, timestamps, soft delete)
│   ├── enums/             # All application enums
│   ├── constants/         # Application constants
│   ├── decorators/        # Custom decorators
│   ├── guards/            # Authorization guards (to be implemented)
│   ├── filters/           # Exception filters
│   ├── interceptors/      # Request/response interceptors
│   ├── pipes/             # Validation pipes
│   └── utils/             # Helper functions
├── database/              # TypeORM configuration
└── modules/
    ├── personas/          # Member management (Protagonista, Educador, Externa)
    ├── cajas/             # Financial accounts (Grupo, Rama, Personal)
    ├── movimientos/       # Income/expense tracking
    ├── inscripciones/     # Scout Argentina inscriptions
    ├── cuotas/            # Group monthly fees
    ├── campamentos/       # Camp management
    └── eventos/           # Sale events and group events
```

### Domain Model

#### Personas (Members)

Uses Single Table Inheritance with discriminator column `tipo`:

| Type | Description |
|------|-------------|
| `Protagonista` | Scout members (7-22 years), belong to a rama, have personal account |
| `Educador` | Adult leaders (22+), may belong to a rama, have personal account |
| `PersonaExterna` | External people (family, etc.), advance money for group expenses, NO personal account |

States: `activo`, `inactivo`

#### Ramas (Branches)

| Rama | Description |
|------|-------------|
| `Manada` | Youngest scouts |
| `Unidad` | Middle scouts |
| `Caminantes` | Older scouts |
| `Rovers` | Oldest scouts |

#### Cajas (Financial Accounts)

| Type | Description |
|------|-------------|
| `GRUPO` | Main group account |
| `RAMA_MANADA/UNIDAD/CAMINANTES/ROVERS` | Branch-specific funds |
| `PERSONAL` | Personal account for Protagonista/Educador |

**Important:** `saldoActual` is NEVER stored, always calculated from movements.

#### Movimientos (Movements)

Types: `ingreso` (income), `egreso` (expense)

Payment methods: `efectivo` (cash), `transferencia` (bank transfer)

15 concepts covering all financial flows:
- Inscriptions: `inscripcion`, `inscripcion_pago_scout_argentina`
- Fees: `cuota_grupo`
- Camps: `campamento_pago`, `campamento_gasto`
- Sale events: `evento_venta_ingreso`, `evento_venta_gasto`
- Group events: `evento_grupo_ingreso`, `evento_grupo_gasto`
- General: `gasto_general`, `reembolso`
- Adjustments: `ajuste_inicial`, `ajuste_bonificacion`
- Internal: `asignacion_fondo_rama`, `transferencia_baja`

### Entity Base Class

All entities extend `BaseEntity` which provides:
- `id`: UUID (auto-generated)
- `createdAt`: Timestamp with timezone
- `updatedAt`: Timestamp with timezone
- `deletedAt`: Soft delete timestamp (nullable)

```typescript
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
```

### Global Request Flow

1. **CORS:** Enabled for frontend (default: `http://localhost:4200`)
2. **Validation:** `ValidationPipe` with whitelist, transform, forbidNonWhitelisted
3. **Handler:** Controller method
4. **Response:** JSON response (Swagger documented)

## Key Patterns & Conventions

### DTO Validation

- Use `class-validator` decorators (@IsString, @IsEmail, @IsEnum, etc.)
- DTOs in `src/modules/{module}/dtos/` directory
- Validation pipes auto-enabled in `main.ts`

### Service Methods

- Services handle business logic and database queries
- Return DTOs in responses, not raw entities
- Use TypeORM repositories with query builders

### Module Structure

Each module follows this structure:
```
modules/{name}/
├── {name}.module.ts       # Module definition
├── controllers/           # HTTP controllers
├── services/              # Business logic
├── entities/              # TypeORM entities
└── dtos/                  # Request/response DTOs
```

### Soft Deletes

All entities support soft delete via `deletedAt` column. Use TypeORM's `softDelete()` method.

## Testing Strategy

### Test Organization

- **Unit tests:** `src/**/*.spec.ts` - Service/utility logic
- **E2E tests:** `test/*.e2e-spec.ts` - API endpoint testing

### Test Database

Separate test database via `docker-compose.test.yml`:
```bash
npm run db:test:start  # Start before running tests
npm run db:test:reset  # Reset if needed
```

## Local Skills & Auto-Invoke

This project includes custom local skills in the `skills/` directory (at project root level).

### Available Skills

| Skill | Description |
|-------|-------------|
| `typescript` | TypeScript types, interfaces, utility types |
| `changelog` | Changelog entries (keepachangelog.com) |
| `commit` | Professional git commits (conventional-commits) |
| `docs` | Documentation style guide |
| `jest` | Testing patterns with Jest for NestJS |
| `nestjs` | NestJS-specific patterns and conventions |
| `typeorm` | TypeORM patterns (entities, relations, queries, soft deletes) |

### Meta Skills

| Skill | Description |
|-------|-------------|
| `workflow` | Guided feature development workflow |
| `codebase-analyzer` | Identifies reusable components |
| `task-spec` | Task specification format validation |
| `code-quality` | Code quality standards |
| `skill-creator` | Create new AI agent skills |
| `skill-sync` | Sync skill metadata |

### Auto-Invoke Rules

Always invoke the skill FIRST when performing these actions:

| Action | Skill |
|--------|-------|
| Committing changes to git | `commit` |
| Creating NestJS services/controllers/modules | `nestjs` |
| Creating NestJS guards/interceptors | `nestjs` |
| Creating TypeORM entities | `typeorm` |
| Creating TypeORM relations | `typeorm` |
| Writing TypeORM queries | `typeorm` |
| Working with soft deletes | `typeorm` |
| Creating test files | `jest` |
| Writing unit/integration/e2e tests | `jest` |
| Writing TypeScript types/interfaces | `typescript` |
| Writing documentation | `docs` |
| Add changelog entry | `changelog` |
| Starting new feature work | `workflow` |

## Commit & Pull Request Guidelines

Follow conventional-commit style: `<type>[scope]: <description>`

**Types:** `feat`, `fix`, `docs`, `chore`, `perf`, `refactor`, `style`, `test`

**Scopes:** `personas`, `cajas`, `movimientos`, `inscripciones`, `cuotas`, `campamentos`, `eventos`, `database`, `common`, `config`, `skills`, `docs`

**Rule:** Never add commit author like "Co-Author: ClaudeCode..."

Before creating a PR:
1. Run all relevant tests and linters
2. Update documentation if needed
3. Follow established patterns

## Important File Locations

| File | Purpose |
|------|---------|
| `src/main.ts` | App bootstrap (CORS, pipes, Swagger setup) |
| `src/app.module.ts` | Root module with all imports |
| `src/common/entities/base.entity.ts` | Base entity with UUID, timestamps, soft delete |
| `src/common/enums/index.ts` | All application enums |
| `src/database/database.module.ts` | TypeORM configuration |
| `.env.local` | Environment variables (local, not committed) |
| `docker-compose.yml` | Development database |
| `docker-compose.test.yml` | Test database |

## Local Development

1. Start database: `docker-compose up -d`
2. Configure `.env.local` with database credentials
3. Start server: `npm run start:dev`
4. Access API docs: `http://localhost:3001/api/docs`

## Future Implementations (Not Yet Built)

The following features are planned but not yet implemented:
- Authentication (JWT with Passport)
- Authorization guards
- User management
- Role-based access control

Currently, the API is open without authentication.
