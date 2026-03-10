# Pago con Saldo Personal - Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Protagonistas and Educadores to pay inscriptions, fees, and camps using their personal account balance.

**Architecture:** Create a new `PagosModule` with an internal `PagosService` that orchestrates payments involving personal balance. Each domain module (inscripciones, cuotas, campamentos) integrates with PagosService for payment logic. All operations are transactional.

**Tech Stack:** NestJS 11+, TypeORM 0.3+, PostgreSQL, class-validator

**Spec:** `docs/superpowers/specs/2026-03-10-pago-saldo-personal-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `src/modules/pagos/pagos.module.ts` | Module definition, exports PagosService |
| `src/modules/pagos/pagos.service.ts` | Payment orchestration with transactions |
| `src/modules/pagos/pagos.service.spec.ts` | Unit tests for PagosService |
| `src/modules/pagos/interfaces/ejecutar-pago.interface.ts` | Internal interface for payment params |
| `src/modules/pagos/dtos/resultado-pago.dto.ts` | Response DTO for payment results |
| `src/modules/pagos/validators/pago.validator.ts` | Custom validator for montoConSaldoPersonal |
| `src/modules/inscripciones/dtos/pagar-inscripcion.dto.ts` | DTO for POST /inscripciones/:id/pagar |

### Modified Files

| File | Change |
|------|--------|
| `src/common/enums/index.ts` | Add SALDO_PERSONAL to MedioPago, USO_SALDO_PERSONAL to ConceptoMovimiento |
| `src/modules/inscripciones/dtos/create-inscripcion.dto.ts` | Add montoConSaldoPersonal field |
| `src/modules/inscripciones/inscripciones.service.ts` | Integrate PagosService, add pagar() method |
| `src/modules/inscripciones/inscripciones.controller.ts` | Add POST /inscripciones/:id/pagar endpoint |
| `src/modules/inscripciones/inscripciones.module.ts` | Import PagosModule |
| `src/app.module.ts` | Import PagosModule |

---

## Chunk 1: Enums and Pagos Module Foundation

### Task 1: Add new enum values

**Files:**
- Modify: `src/common/enums/index.ts:125-128` (MedioPago)
- Modify: `src/common/enums/index.ts:83-118` (ConceptoMovimiento)

- [ ] **Step 1: Add SALDO_PERSONAL to MedioPago enum**

```typescript
// In src/common/enums/index.ts, update MedioPago enum (around line 125)
export enum MedioPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  SALDO_PERSONAL = 'saldo_personal',
}
```

- [ ] **Step 2: Add USO_SALDO_PERSONAL to ConceptoMovimiento enum**

```typescript
// In src/common/enums/index.ts, add to ConceptoMovimiento enum (after TRANSFERENCIA_BAJA)
  // Transferencias internas
  TRANSFERENCIA_BAJA = 'transferencia_baja', // Transferencia de cuenta personal a caja al dar baja

  // Uso de saldo personal
  USO_SALDO_PERSONAL = 'uso_saldo_personal', // Egreso desde caja personal para pago
}
```

- [ ] **Step 3: Verify enum changes compile**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/common/enums/index.ts
git commit -m "feat(enums): add SALDO_PERSONAL and USO_SALDO_PERSONAL values"
```

---

### Task 2: Create PagosModule structure

**Files:**
- Create: `src/modules/pagos/pagos.module.ts`
- Create: `src/modules/pagos/interfaces/ejecutar-pago.interface.ts`
- Create: `src/modules/pagos/dtos/resultado-pago.dto.ts`

- [ ] **Step 1: Create ejecutar-pago interface**

```typescript
// src/modules/pagos/interfaces/ejecutar-pago.interface.ts
import { MedioPago, ConceptoMovimiento } from '../../../common/enums';

export interface EjecutarPagoParams {
  personaId: string;
  montoTotal: number;
  montoConSaldoPersonal: number;
  medioPago?: MedioPago;
  concepto: ConceptoMovimiento;
  inscripcionId?: string;
  cuotaId?: string;
  campamentoId?: string;
  descripcion?: string;
}
```

- [ ] **Step 2: Create resultado-pago DTO**

```typescript
// src/modules/pagos/dtos/resultado-pago.dto.ts
import { ConceptoMovimiento, MedioPago } from '../../../common/enums';

export class MovimientoIngresoResultDto {
  id!: string;
  monto!: number;
  concepto!: ConceptoMovimiento;
  medioPago!: MedioPago;
}

export class MovimientoEgresoResultDto {
  id!: string;
  monto!: number;
}

export class DesgloseResultDto {
  montoSaldoPersonal!: number;
  montoFisico!: number;
  total!: number;
}

export class ResultadoPagoDto {
  movimientoIngreso!: MovimientoIngresoResultDto;
  movimientoEgresoPersonal?: MovimientoEgresoResultDto;
  desglose!: DesgloseResultDto;
}
```

- [ ] **Step 3: Create pagos.module.ts (empty service for now)**

```typescript
// src/modules/pagos/pagos.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [
    forwardRef(() => CajasModule),
    forwardRef(() => MovimientosModule),
  ],
  providers: [PagosService],
  exports: [PagosService],
})
export class PagosModule {}
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/pagos/
git commit -m "feat(pagos): create module structure with interfaces and DTOs"
```

---

### Task 3: Create custom validator

**Files:**
- Create: `src/modules/pagos/validators/pago.validator.ts`

- [ ] **Step 1: Create ValidarMontoSaldoPersonal decorator**

```typescript
// src/modules/pagos/validators/pago.validator.ts
import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function ValidarMontoSaldoPersonal(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'validarMontoSaldoPersonal',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const obj = args.object as Record<string, unknown>;
          const montoConSaldoPersonal =
            typeof value === 'number' ? value : 0;
          const montoPagado =
            typeof obj.montoPagado === 'number' ? obj.montoPagado : 0;
          return montoConSaldoPersonal <= montoPagado;
        },
        defaultMessage() {
          return 'El monto de saldo personal no puede superar el monto pagado';
        },
      },
    });
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/pagos/validators/
git commit -m "feat(pagos): add custom validator for montoConSaldoPersonal"
```

---

### Task 4: Create PagosService with tests (TDD)

**Files:**
- Create: `src/modules/pagos/pagos.service.spec.ts`
- Create: `src/modules/pagos/pagos.service.ts`

- [ ] **Step 1: Write failing tests for PagosService**

```typescript
// src/modules/pagos/pagos.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PagosService } from './pagos.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { DataSource, EntityManager } from 'typeorm';
import {
  MedioPago,
  ConceptoMovimiento,
  TipoMovimiento,
  EstadoPago,
  CajaType,
} from '../../common/enums';
import { BadRequestException } from '@nestjs/common';

describe('PagosService', () => {
  let service: PagosService;
  let cajasService: jest.Mocked<CajasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let mockManager: jest.Mocked<EntityManager>;

  const mockCajaGrupo = {
    id: 'caja-grupo-id',
    tipo: CajaType.GRUPO,
  };

  const mockCajaPersonal = {
    id: 'caja-personal-id',
    tipo: CajaType.PERSONAL,
    propietarioId: 'persona-id',
  };

  beforeEach(async () => {
    mockManager = {
      create: jest.fn().mockImplementation((_, data) => ({
        id: 'new-mov-id',
        ...data,
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    } as unknown as jest.Mocked<EntityManager>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        {
          provide: CajasService,
          useValue: {
            findCajaGrupo: jest.fn().mockResolvedValue(mockCajaGrupo),
            findCajaPersonal: jest.fn().mockResolvedValue(mockCajaPersonal),
          },
        },
        {
          provide: MovimientosService,
          useValue: {
            calcularSaldo: jest.fn().mockResolvedValue(10000),
          },
        },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PagosService>(PagosService);
    cajasService = module.get(CajasService);
    movimientosService = module.get(MovimientosService);
  });

  describe('ejecutarPagoConManager', () => {
    it('debería crear solo INGRESO cuando montoConSaldoPersonal es 0', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 0,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        inscripcionId: 'inscripcion-id',
      });

      expect(result.movimientoEgresoPersonal).toBeUndefined();
      expect(result.movimientoIngreso).toBeDefined();
      expect(result.movimientoIngreso.monto).toBe(5000);
      expect(result.desglose.montoSaldoPersonal).toBe(0);
      expect(result.desglose.montoFisico).toBe(5000);
    });

    it('debería crear EGRESO + INGRESO cuando usa saldo personal', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 3000,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        inscripcionId: 'inscripcion-id',
      });

      expect(result.movimientoEgresoPersonal).toBeDefined();
      expect(result.movimientoEgresoPersonal?.monto).toBe(3000);
      expect(result.movimientoIngreso.monto).toBe(5000);
      expect(result.desglose.montoSaldoPersonal).toBe(3000);
      expect(result.desglose.montoFisico).toBe(2000);
    });

    it('debería usar medioPago efectivo por defecto', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 0,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
      });

      expect(result.movimientoIngreso.medioPago).toBe(MedioPago.EFECTIVO);
    });

    it('debería usar medioPago saldo_personal cuando es 100% saldo', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 5000,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
      });

      expect(result.movimientoIngreso.medioPago).toBe(MedioPago.SALDO_PERSONAL);
    });

    it('debería fallar si persona no tiene caja personal', async () => {
      cajasService.findCajaPersonal.mockResolvedValue(null);

      await expect(
        service.ejecutarPagoConManager(mockManager, {
          personaId: 'persona-id',
          montoTotal: 5000,
          montoConSaldoPersonal: 3000,
          concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería fallar si saldo insuficiente', async () => {
      movimientosService.calcularSaldo.mockResolvedValue(1000);

      await expect(
        service.ejecutarPagoConManager(mockManager, {
          personaId: 'persona-id',
          montoTotal: 5000,
          montoConSaldoPersonal: 3000,
          concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=pagos.service.spec.ts`
Expected: Tests fail because PagosService doesn't exist yet

- [ ] **Step 3: Implement PagosService**

```typescript
// src/modules/pagos/pagos.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { EjecutarPagoParams } from './interfaces/ejecutar-pago.interface';
import { ResultadoPagoDto } from './dtos/resultado-pago.dto';
import {
  MedioPago,
  ConceptoMovimiento,
  TipoMovimiento,
  EstadoPago,
} from '../../common/enums';

@Injectable()
export class PagosService {
  constructor(
    private readonly cajasService: CajasService,
    private readonly movimientosService: MovimientosService,
    private readonly dataSource: DataSource,
  ) {}

  async ejecutarPagoConManager(
    manager: EntityManager,
    params: EjecutarPagoParams,
  ): Promise<ResultadoPagoDto> {
    const {
      personaId,
      montoTotal,
      montoConSaldoPersonal = 0,
      medioPago = MedioPago.EFECTIVO,
      concepto,
      inscripcionId,
      cuotaId,
      campamentoId,
      descripcion,
    } = params;

    const montoFisico = montoTotal - montoConSaldoPersonal;
    let movimientoEgresoPersonal: Movimiento | undefined;

    // 1. Crear EGRESO de caja personal (si aplica)
    if (montoConSaldoPersonal > 0) {
      const cajaPersonal = await this.cajasService.findCajaPersonal(personaId);
      if (!cajaPersonal) {
        throw new BadRequestException('La persona no tiene caja personal');
      }

      const saldoDisponible = await this.movimientosService.calcularSaldo(
        cajaPersonal.id,
      );
      if (saldoDisponible < montoConSaldoPersonal) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponible: $${saldoDisponible}, Requerido: $${montoConSaldoPersonal}`,
        );
      }

      movimientoEgresoPersonal = manager.create(Movimiento, {
        cajaId: cajaPersonal.id,
        tipo: TipoMovimiento.EGRESO,
        monto: montoConSaldoPersonal,
        concepto: ConceptoMovimiento.USO_SALDO_PERSONAL,
        medioPago: MedioPago.SALDO_PERSONAL,
        responsableId: personaId,
        estadoPago: EstadoPago.PAGADO,
        inscripcionId,
        cuotaId,
        campamentoId,
        descripcion: descripcion ?? 'Uso de saldo personal para pago',
        fecha: new Date(),
      });

      await manager.save(movimientoEgresoPersonal);
    }

    // 2. Crear INGRESO en caja grupo
    const cajaGrupo = await this.cajasService.findCajaGrupo();

    const movimientoIngreso = manager.create(Movimiento, {
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.INGRESO,
      monto: montoTotal,
      concepto,
      medioPago: montoFisico > 0 ? medioPago : MedioPago.SALDO_PERSONAL,
      responsableId: personaId,
      estadoPago: EstadoPago.PAGADO,
      inscripcionId,
      cuotaId,
      campamentoId,
      descripcion,
      fecha: new Date(),
    });

    await manager.save(movimientoIngreso);

    // 3. Retornar resultado
    return {
      movimientoIngreso: {
        id: movimientoIngreso.id,
        monto: Number(movimientoIngreso.monto),
        concepto: movimientoIngreso.concepto,
        medioPago: movimientoIngreso.medioPago,
      },
      movimientoEgresoPersonal: movimientoEgresoPersonal
        ? {
            id: movimientoEgresoPersonal.id,
            monto: Number(movimientoEgresoPersonal.monto),
          }
        : undefined,
      desglose: {
        montoSaldoPersonal: montoConSaldoPersonal,
        montoFisico,
        total: montoTotal,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=pagos.service.spec.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/modules/pagos/
git commit -m "feat(pagos): implement PagosService with TDD"
```

---

## Chunk 2: Integrate with Inscripciones Module

### Task 5: Update CreateInscripcionDto

**Files:**
- Modify: `src/modules/inscripciones/dtos/create-inscripcion.dto.ts`

- [ ] **Step 1: Add montoConSaldoPersonal field**

```typescript
// Add after medioPago field in create-inscripcion.dto.ts (around line 117)

  @ApiPropertyOptional({
    example: 3000.0,
    minimum: 0,
    description:
      'Monto a descontar de la caja personal (default: 0). Debe ser menor o igual a montoPagado.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoConSaldoPersonal?: number;
```

- [ ] **Step 2: Add import for validator (if using custom validator)**

The custom validator can be used optionally. For now, we validate in the service.

- [ ] **Step 3: Commit**

```bash
git add src/modules/inscripciones/dtos/create-inscripcion.dto.ts
git commit -m "feat(inscripciones): add montoConSaldoPersonal to CreateInscripcionDto"
```

---

### Task 6: Create PagarInscripcionDto

**Files:**
- Create: `src/modules/inscripciones/dtos/pagar-inscripcion.dto.ts`
- Modify: `src/modules/inscripciones/dtos/index.ts`

- [ ] **Step 1: Create PagarInscripcionDto**

```typescript
// src/modules/inscripciones/dtos/pagar-inscripcion.dto.ts
import { IsNumber, IsPositive, IsOptional, IsEnum, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedioPago } from '../../../common/enums';

export class PagarInscripcionDto {
  @ApiProperty({
    example: 5000.0,
    minimum: 0.01,
    description: 'Monto total a pagar',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoPagado!: number;

  @ApiPropertyOptional({
    example: 3000.0,
    minimum: 0,
    description: 'Monto a descontar de la caja personal (default: 0)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoConSaldoPersonal?: number;

  @ApiPropertyOptional({
    enum: MedioPago,
    example: MedioPago.EFECTIVO,
    description: 'Medio de pago para la parte no cubierta por saldo personal (default: efectivo)',
  })
  @IsEnum(MedioPago)
  @IsOptional()
  medioPago?: MedioPago;

  @ApiPropertyOptional({
    example: 'Pago parcial de inscripción',
    description: 'Descripción opcional del pago',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;
}
```

- [ ] **Step 2: Export from index**

```typescript
// Add to src/modules/inscripciones/dtos/index.ts
export * from './pagar-inscripcion.dto';
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/inscripciones/dtos/
git commit -m "feat(inscripciones): create PagarInscripcionDto"
```

---

### Task 7: Update InscripcionesModule to import PagosModule

**Files:**
- Modify: `src/modules/inscripciones/inscripciones.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Read current inscripciones.module.ts**

- [ ] **Step 2: Add PagosModule import to InscripcionesModule**

```typescript
// In inscripciones.module.ts, add import
import { PagosModule } from '../pagos/pagos.module';

// Add to imports array
imports: [
  // ... existing imports
  forwardRef(() => PagosModule),
],
```

- [ ] **Step 3: Add PagosModule to AppModule**

```typescript
// In app.module.ts, add import
import { PagosModule } from './modules/pagos/pagos.module';

// Add to imports array (after MovimientosModule)
imports: [
  // ... existing
  PagosModule,
  // ...
],
```

- [ ] **Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/modules/inscripciones/inscripciones.module.ts src/app.module.ts
git commit -m "feat(inscripciones): integrate PagosModule"
```

---

### Task 8: Update InscripcionesService to use PagosService (TDD)

**Files:**
- Modify: `src/modules/inscripciones/inscripciones.service.spec.ts`
- Modify: `src/modules/inscripciones/inscripciones.service.ts`

- [ ] **Step 1: Add tests for pago con saldo personal**

```typescript
// Add to inscripciones.service.spec.ts

describe('registrarInscripcion con saldo personal', () => {
  it('debería crear inscripción + movimientos cuando hay pago con saldo personal', async () => {
    // Test implementation
  });

  it('debería fallar si montoConSaldoPersonal > montoPagado', async () => {
    // Test implementation
  });
});

describe('pagar', () => {
  it('debería registrar pago en inscripción existente', async () => {
    // Test implementation
  });

  it('debería registrar pago con saldo personal', async () => {
    // Test implementation
  });

  it('debería fallar si inscripción ya está pagada', async () => {
    // Test implementation
  });

  it('debería fallar si monto excede saldo pendiente', async () => {
    // Test implementation
  });
});
```

- [ ] **Step 2: Update InscripcionesService - add PagosService dependency**

```typescript
// In inscripciones.service.ts, add import
import { PagosService } from '../pagos/pagos.service';
import { DataSource } from 'typeorm';

// Update constructor
constructor(
  @InjectRepository(Inscripcion)
  private readonly inscripcionRepository: Repository<Inscripcion>,
  private readonly personasService: PersonasService,
  @Inject(forwardRef(() => MovimientosService))
  private readonly movimientosService: MovimientosService,
  private readonly cajasService: CajasService,
  @Inject(forwardRef(() => PagosService))
  private readonly pagosService: PagosService,
  private readonly dataSource: DataSource,
) {}
```

- [ ] **Step 3: Update registrarInscripcion to use transactions and PagosService**

```typescript
async registrarInscripcion(
  dto: CreateInscripcionDto,
): Promise<InscripcionResponseDto> {
  await this.personasService.findOne(dto.personaId);

  const existente = await this.inscripcionRepository.findOne({
    where: {
      personaId: dto.personaId,
      ano: dto.ano,
      tipo: dto.tipo,
    },
  });

  if (existente) {
    throw new BadRequestException(
      `Ya existe una inscripción de tipo ${dto.tipo} para esta persona en el año ${dto.ano}`,
    );
  }

  const montoBonificado = dto.montoBonificado ?? 0;
  if (montoBonificado > dto.montoTotal) {
    throw new BadRequestException(
      'El monto bonificado no puede exceder el monto total',
    );
  }

  const montoPagado = dto.montoPagado ?? 0;
  const montoConSaldoPersonal = dto.montoConSaldoPersonal ?? 0;

  // Validar que montoConSaldoPersonal <= montoPagado
  if (montoConSaldoPersonal > montoPagado) {
    throw new BadRequestException(
      'El monto de saldo personal no puede superar el monto pagado',
    );
  }

  const esScoutArgentina = dto.tipo === TipoInscripcion.SCOUT_ARGENTINA;

  // Usar transacción para crear inscripción y movimientos
  return this.dataSource.transaction(async (manager) => {
    const inscripcion = manager.create(Inscripcion, {
      personaId: dto.personaId,
      tipo: dto.tipo,
      ano: dto.ano,
      montoTotal: dto.montoTotal,
      montoBonificado,
      declaracionDeSalud: esScoutArgentina
        ? (dto.declaracionDeSalud ?? false)
        : false,
      autorizacionDeImagen: esScoutArgentina
        ? (dto.autorizacionDeImagen ?? false)
        : false,
      salidasCercanas: esScoutArgentina
        ? (dto.salidasCercanas ?? false)
        : false,
      autorizacionIngreso: esScoutArgentina
        ? (dto.autorizacionIngreso ?? false)
        : false,
      certificadoAptitudFisica: esScoutArgentina
        ? (dto.certificadoAptitudFisica ?? false)
        : false,
    });

    const savedInscripcion = await manager.save(inscripcion);

    // Si hay un pago inicial, usar PagosService
    if (montoPagado > 0) {
      const concepto =
        dto.tipo === TipoInscripcion.SCOUT_ARGENTINA
          ? ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA
          : ConceptoMovimiento.INSCRIPCION_GRUPO;

      await this.pagosService.ejecutarPagoConManager(manager, {
        personaId: dto.personaId,
        montoTotal: montoPagado,
        montoConSaldoPersonal,
        medioPago: dto.medioPago,
        concepto,
        inscripcionId: savedInscripcion.id,
        descripcion: `Pago inscripción ${dto.tipo} ${dto.ano}`,
      });
    }

    // Reload with persona relation for response
    const reloaded = await manager.findOne(Inscripcion, {
      where: { id: savedInscripcion.id },
      relations: ['persona'],
    });

    return this.toResponseDto(reloaded!);
  });
}
```

- [ ] **Step 4: Add pagar method**

```typescript
async pagar(
  id: string,
  dto: PagarInscripcionDto,
): Promise<InscripcionResponseDto> {
  const inscripcion = await this.findOneEntity(id);
  const responseDto = await this.toResponseDto(inscripcion);

  // Validar que no esté completamente pagada
  if (responseDto.saldoPendiente <= 0) {
    throw new BadRequestException(
      'La inscripción ya está completamente pagada',
    );
  }

  // Validar que el monto no exceda el saldo pendiente
  if (dto.montoPagado > responseDto.saldoPendiente) {
    throw new BadRequestException(
      `El monto excede el saldo pendiente ($${responseDto.saldoPendiente})`,
    );
  }

  const montoConSaldoPersonal = dto.montoConSaldoPersonal ?? 0;

  // Validar que montoConSaldoPersonal <= montoPagado
  if (montoConSaldoPersonal > dto.montoPagado) {
    throw new BadRequestException(
      'El monto de saldo personal no puede superar el monto pagado',
    );
  }

  const concepto =
    inscripcion.tipo === TipoInscripcion.SCOUT_ARGENTINA
      ? ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA
      : ConceptoMovimiento.INSCRIPCION_GRUPO;

  return this.dataSource.transaction(async (manager) => {
    await this.pagosService.ejecutarPagoConManager(manager, {
      personaId: inscripcion.personaId,
      montoTotal: dto.montoPagado,
      montoConSaldoPersonal,
      medioPago: dto.medioPago,
      concepto,
      inscripcionId: inscripcion.id,
      descripcion: dto.descripcion ?? `Pago inscripción ${inscripcion.tipo} ${inscripcion.ano}`,
    });

    // Reload for response
    const reloaded = await manager.findOne(Inscripcion, {
      where: { id: inscripcion.id },
      relations: ['persona'],
    });

    return this.toResponseDto(reloaded!);
  });
}
```

- [ ] **Step 5: Add import for PagarInscripcionDto**

```typescript
import { PagarInscripcionDto } from './dtos/pagar-inscripcion.dto';
```

- [ ] **Step 6: Run tests**

Run: `npm test -- --testPathPattern=inscripciones`
Expected: Tests pass

- [ ] **Step 7: Commit**

```bash
git add src/modules/inscripciones/
git commit -m "feat(inscripciones): integrate PagosService for payments with personal balance"
```

---

### Task 9: Add pagar endpoint to InscripcionesController

**Files:**
- Modify: `src/modules/inscripciones/inscripciones.controller.ts`

- [ ] **Step 1: Read current controller**

- [ ] **Step 2: Add POST /inscripciones/:id/pagar endpoint**

```typescript
// Add import
import { PagarInscripcionDto } from './dtos/pagar-inscripcion.dto';

// Add endpoint after other POST methods
@Post(':id/pagar')
@ApiOperation({ summary: 'Registrar pago de inscripción' })
@ApiParam({ name: 'id', description: 'ID de la inscripción' })
@ApiResponse({
  status: 200,
  description: 'Pago registrado exitosamente',
  type: InscripcionResponseDto,
})
@ApiResponse({ status: 400, description: 'Error de validación o pago' })
@ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
async pagar(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: PagarInscripcionDto,
): Promise<InscripcionResponseDto> {
  return this.inscripcionesService.pagar(id, dto);
}
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/modules/inscripciones/inscripciones.controller.ts
git commit -m "feat(inscripciones): add POST /inscripciones/:id/pagar endpoint"
```

---

### Task 10: Final integration test

**Files:**
- Run E2E tests

- [ ] **Step 1: Start test database**

Run: `npm run db:test:start`

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(pagos): complete payment with personal balance feature for inscripciones"
```

---

## Summary

This plan implements payment with personal account balance for inscriptions. The pattern established here (using PagosService) can be extended to cuotas and campamentos following the same approach:

1. Add `montoConSaldoPersonal` to the payment DTO
2. Import PagosModule in the domain module
3. Use `pagosService.ejecutarPagoConManager()` within a transaction
4. Add the `/pagar` endpoint to the controller

**Files Created:** 7
**Files Modified:** 7
**Total Tasks:** 10
**Estimated Commits:** 10
