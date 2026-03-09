# Inscripciones: Soporte para Dos Tipos - Plan de Implementación

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agregar soporte para dos tipos de inscripción (GRUPO y SCOUT_ARGENTINA) con bonificación manual y simplificada.

**Architecture:** Agregar enum TipoInscripcion, modificar entidad Inscripcion para incluir tipo y eliminar campos calculados (montoPagado, estado), actualizar servicio para calcular estado dinámicamente desde movimientos, y limpiar lógica de bonificación automática.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, class-validator

**Design Doc:** [docs/plans/2026-03-09-inscripciones-tipos-design.md](./2026-03-09-inscripciones-tipos-design.md)

---

## Task 1: Agregar enum TipoInscripcion

**Files:**
- Modify: `src/common/enums/index.ts`

**Step 1: Agregar el enum TipoInscripcion**

Agregar después del bloque de `EstadoInscripcion` (línea ~142):

```typescript
/**
 * Tipos de inscripción
 * From Design Doc: GRUPO (grupo local) y SCOUT_ARGENTINA (nacional)
 */
export enum TipoInscripcion {
  GRUPO = 'grupo',
  SCOUT_ARGENTINA = 'scout_argentina',
}
```

**Step 2: Agregar nuevos conceptos de movimiento**

Modificar el enum `ConceptoMovimiento` para distinguir inscripciones:

```typescript
// Inscripciones - reemplazar las líneas existentes
INSCRIPCION_GRUPO = 'inscripcion_grupo', // Ingreso: cobro inscripción grupo
INSCRIPCION_SCOUT_ARGENTINA = 'inscripcion_scout_argentina', // Ingreso: cobro inscripción SA
INSCRIPCION_PAGO_SCOUT_ARGENTINA = 'inscripcion_pago_scout_argentina', // Egreso: pago global a SA
```

**Step 3: Eliminar concepto AJUSTE_BONIFICACION**

Eliminar la línea:
```typescript
AJUSTE_BONIFICACION = 'ajuste_bonificacion', // Ajuste por bonificación de inscripción
```

**Step 4: Commit**

```bash
git add src/common/enums/index.ts
git commit -m "feat(inscripciones): add TipoInscripcion enum and update ConceptoMovimiento"
```

---

## Task 2: Modificar entidad Inscripcion

**Files:**
- Modify: `src/modules/inscripciones/entities/inscripcion.entity.ts`

**Step 1: Agregar import de TipoInscripcion**

```typescript
import { EstadoInscripcion, TipoInscripcion } from '../../../common/enums';
```

**Step 2: Agregar campo tipo**

Agregar después de `personaId`:

```typescript
/**
 * Type of inscription: GRUPO or SCOUT_ARGENTINA
 */
@Column({ type: 'enum', enum: TipoInscripcion })
tipo!: TipoInscripcion;
```

**Step 3: Agregar unique constraint**

Agregar decorador a nivel de clase:

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';

@Entity('inscripciones')
@Unique(['personaId', 'ano', 'tipo'])
export class Inscripcion extends BaseEntity {
```

**Step 4: Eliminar campos que serán calculados**

Eliminar las siguientes propiedades:
- `montoPagado` (columna y decorador)
- `estado` (columna y decorador)
- `movimientoBonificacionId` (columna)

**Step 5: Verificar resultado final**

La entidad debe quedar así:

```typescript
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TipoInscripcion } from '../../../common/enums';
import { Persona } from '../../personas/entities/persona.entity';

/**
 * Inscripcion entity - Annual registration (Grupo or Scout Argentina)
 *
 * Each inscription records a person for a specific year and type.
 * Payment status is calculated dynamically from related movements.
 */
@Entity('inscripciones')
@Unique(['personaId', 'ano', 'tipo'])
export class Inscripcion extends BaseEntity {
  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @Column({ name: 'persona_id' })
  personaId!: string;

  @Column({ type: 'enum', enum: TipoInscripcion })
  tipo!: TipoInscripcion;

  @Column()
  ano!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  montoTotal!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  montoBonificado!: number;
}
```

**Step 6: Commit**

```bash
git add src/modules/inscripciones/entities/inscripcion.entity.ts
git commit -m "feat(inscripciones): add tipo field and remove calculated fields from entity"
```

---

## Task 3: Actualizar DTO CreateInscripcionDto

**Files:**
- Modify: `src/modules/inscripciones/dtos/create-inscripcion.dto.ts`

**Step 1: Reemplazar contenido completo**

```typescript
import {
  IsNumber,
  IsUUID,
  IsPositive,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoInscripcion } from '../../../common/enums';

export class CreateInscripcionDto {
  @ApiProperty({ format: 'uuid', description: 'ID de la persona' })
  @IsUUID()
  personaId!: string;

  @ApiProperty({
    enum: TipoInscripcion,
    example: TipoInscripcion.GRUPO,
    description: 'Tipo de inscripción',
  })
  @IsEnum(TipoInscripcion)
  tipo!: TipoInscripcion;

  @ApiProperty({ example: 2026, minimum: 2020, maximum: 2100 })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  ano!: number;

  @ApiProperty({
    example: 15000.0,
    minimum: 0.01,
    description: 'Monto total de la inscripción',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoTotal!: number;

  @ApiPropertyOptional({
    example: 5000.0,
    minimum: 0,
    description: 'Monto bonificado (default: 0)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoBonificado?: number;
}
```

**Step 2: Commit**

```bash
git add src/modules/inscripciones/dtos/create-inscripcion.dto.ts
git commit -m "feat(inscripciones): update CreateInscripcionDto with tipo and montoBonificado"
```

---

## Task 4: Refactorizar InscripcionesService

**Files:**
- Modify: `src/modules/inscripciones/inscripciones.service.ts`

**Step 1: Actualizar imports**

```typescript
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inscripcion } from './entities/inscripcion.entity';
import { CreateInscripcionDto } from './dtos/create-inscripcion.dto';
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import {
  EstadoInscripcion,
  TipoInscripcion,
  TipoMovimiento,
} from '../../common/enums';
```

**Step 2: Actualizar constructor**

Eliminar `CajasService` del constructor:

```typescript
@Injectable()
export class InscripcionesService {
  constructor(
    @InjectRepository(Inscripcion)
    private readonly inscripcionRepository: Repository<Inscripcion>,
    private readonly personasService: PersonasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
  ) {}
```

**Step 3: Reemplazar método create por registrarInscripcion**

```typescript
async registrarInscripcion(dto: CreateInscripcionDto): Promise<Inscripcion> {
  // Validar que la persona existe
  await this.personasService.findOne(dto.personaId);

  // Verificar que no exista inscripción para este año y tipo
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

  // Validar que montoBonificado no exceda montoTotal
  const montoBonificado = dto.montoBonificado ?? 0;
  if (montoBonificado > dto.montoTotal) {
    throw new BadRequestException(
      'El monto bonificado no puede exceder el monto total',
    );
  }

  const inscripcion = this.inscripcionRepository.create({
    personaId: dto.personaId,
    tipo: dto.tipo,
    ano: dto.ano,
    montoTotal: dto.montoTotal,
    montoBonificado,
  });

  return this.inscripcionRepository.save(inscripcion);
}
```

**Step 4: Agregar método getMontoPagado**

```typescript
/**
 * Calcula el monto pagado sumando los movimientos de ingreso vinculados
 */
async getMontoPagado(inscripcionId: string): Promise<number> {
  const movimientos = await this.movimientosService.findByRelatedEntity(
    'inscripcion',
    inscripcionId,
  );

  return movimientos
    .filter((m) => m.tipo === TipoMovimiento.INGRESO)
    .reduce((sum, m) => sum + Number(m.monto), 0);
}
```

**Step 5: Agregar método getEstado**

```typescript
/**
 * Calcula el estado de la inscripción dinámicamente
 */
async getEstado(inscripcion: Inscripcion): Promise<EstadoInscripcion> {
  const montoPagado = await this.getMontoPagado(inscripcion.id);
  const totalCubierto = montoPagado + Number(inscripcion.montoBonificado);

  if (totalCubierto >= Number(inscripcion.montoTotal)) {
    return EstadoInscripcion.PAGADO;
  }
  if (totalCubierto > 0) {
    return EstadoInscripcion.PARCIAL;
  }
  return EstadoInscripcion.PENDIENTE;
}
```

**Step 6: Agregar método findByAnoAndTipo**

```typescript
async findByAnoAndTipo(
  ano: number,
  tipo: TipoInscripcion,
): Promise<Inscripcion[]> {
  return this.inscripcionRepository.find({
    where: { ano, tipo },
    relations: ['persona'],
    order: { createdAt: 'DESC' },
  });
}
```

**Step 7: Agregar método para obtener inscripción con estado calculado**

```typescript
/**
 * Obtiene una inscripción con su estado y monto pagado calculados
 */
async findOneWithEstado(id: string): Promise<{
  inscripcion: Inscripcion;
  montoPagado: number;
  estado: EstadoInscripcion;
}> {
  const inscripcion = await this.findOne(id);
  const montoPagado = await this.getMontoPagado(id);
  const estado = await this.getEstado(inscripcion);

  return { inscripcion, montoPagado, estado };
}
```

**Step 8: Eliminar métodos registrarPago y registrarPagoScoutArgentina**

Eliminar completamente estos dos métodos del servicio.

**Step 9: Actualizar findByAno para incluir tipo en filtros opcionales**

```typescript
async findByAno(ano: number, tipo?: TipoInscripcion): Promise<Inscripcion[]> {
  const where: { ano: number; tipo?: TipoInscripcion } = { ano };
  if (tipo) {
    where.tipo = tipo;
  }

  return this.inscripcionRepository.find({
    where,
    relations: ['persona'],
    order: { createdAt: 'DESC' },
  });
}
```

**Step 10: Commit**

```bash
git add src/modules/inscripciones/inscripciones.service.ts
git commit -m "refactor(inscripciones): simplify service with dynamic state calculation"
```

---

## Task 5: Actualizar InscripcionesController

**Files:**
- Modify: `src/modules/inscripciones/inscripciones.controller.ts`

**Step 1: Reemplazar contenido completo**

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { InscripcionesService } from './inscripciones.service';
import { CreateInscripcionDto } from './dtos/create-inscripcion.dto';
import { TipoInscripcion } from '../../common/enums';

@ApiTags('Inscripciones')
@Controller('inscripciones')
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las inscripciones' })
  @ApiQuery({ name: 'ano', type: Number, required: false })
  @ApiQuery({ name: 'tipo', enum: TipoInscripcion, required: false })
  @ApiResponse({ status: 200, description: 'Lista de inscripciones' })
  async findAll(
    @Query('ano') ano?: number,
    @Query('tipo') tipo?: TipoInscripcion,
  ) {
    if (ano) {
      return this.inscripcionesService.findByAno(ano, tipo);
    }
    return this.inscripcionesService.findAll();
  }

  @Get('persona/:personaId')
  @ApiOperation({ summary: 'Listar inscripciones de una persona' })
  @ApiParam({ name: 'personaId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inscripciones de la persona' })
  async findByPersona(@Param('personaId', ParseUUIDPipe) personaId: string) {
    return this.inscripcionesService.findByPersona(personaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una inscripción por ID con estado calculado' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inscripción con estado y monto pagado' })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inscripcionesService.findOneWithEstado(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una inscripción' })
  @ApiResponse({ status: 201, description: 'Inscripción creada' })
  @ApiResponse({
    status: 400,
    description: 'Ya existe inscripción para este año y tipo',
  })
  async create(@Body() dto: CreateInscripcionDto) {
    return this.inscripcionesService.registrarInscripcion(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una inscripción (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inscripción eliminada' })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inscripcionesService.remove(id);
  }
}
```

**Step 2: Commit**

```bash
git add src/modules/inscripciones/inscripciones.controller.ts
git commit -m "refactor(inscripciones): simplify controller, remove payment endpoints"
```

---

## Task 6: Actualizar InscripcionesModule

**Files:**
- Modify: `src/modules/inscripciones/inscripciones.module.ts`

**Step 1: Verificar y actualizar imports si es necesario**

Asegurarse de que el módulo importa `MovimientosModule` pero no necesita `CajasModule`:

```typescript
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inscripcion } from './entities/inscripcion.entity';
import { InscripcionesService } from './inscripciones.service';
import { InscripcionesController } from './inscripciones.controller';
import { PersonasModule } from '../personas/personas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Inscripcion]),
    PersonasModule,
    forwardRef(() => MovimientosModule),
  ],
  controllers: [InscripcionesController],
  providers: [InscripcionesService],
  exports: [InscripcionesService],
})
export class InscripcionesModule {}
```

**Step 2: Commit**

```bash
git add src/modules/inscripciones/inscripciones.module.ts
git commit -m "refactor(inscripciones): update module imports"
```

---

## Task 7: Limpiar entidad Protagonista

**Files:**
- Modify: `src/modules/personas/entities/persona.entity.ts`

**Step 1: Eliminar campo fueBonificado**

En la clase `Protagonista`, eliminar:

```typescript
@Column({ default: false })
fueBonificado!: boolean;
```

**Step 2: Actualizar comentario de la clase**

```typescript
/**
 * Protagonista: Chicos que participan del grupo scout (7-22 años)
 * - Pertenece a exactamente una rama
 * - Tiene cuenta personal
 */
@ChildEntity(PersonaType.PROTAGONISTA)
export class Protagonista extends Persona {
  @Column({ type: 'enum', enum: Rama })
  rama!: Rama;
}
```

**Step 3: Commit**

```bash
git add src/modules/personas/entities/persona.entity.ts
git commit -m "refactor(personas): remove fueBonificado field from Protagonista"
```

---

## Task 8: Limpiar PersonasService

**Files:**
- Modify: `src/modules/personas/personas.service.ts`

**Step 1: Eliminar método marcarBonificado**

Eliminar completamente el método `marcarBonificado` (líneas 226-237).

**Step 2: Actualizar createProtagonista**

Eliminar la línea `fueBonificado: false` del método:

```typescript
async createProtagonista(dto: CreateProtagonistaDto): Promise<Protagonista> {
  const protagonista = this.protagonistaRepository.create({
    ...dto,
    tipo: PersonaType.PROTAGONISTA,
    estado: EstadoPersona.ACTIVO,
  });

  return this.protagonistaRepository.save(protagonista);
}
```

**Step 3: Commit**

```bash
git add src/modules/personas/personas.service.ts
git commit -m "refactor(personas): remove marcarBonificado method"
```

---

## Task 9: Escribir tests unitarios para InscripcionesService

**Files:**
- Create: `src/modules/inscripciones/inscripciones.service.spec.ts`

**Step 1: Crear archivo de tests**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { Inscripcion } from './entities/inscripcion.entity';
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { TipoInscripcion, TipoMovimiento, EstadoInscripcion } from '../../common/enums';

describe('InscripcionesService', () => {
  let service: InscripcionesService;
  let repository: jest.Mocked<Repository<Inscripcion>>;
  let personasService: jest.Mocked<PersonasService>;
  let movimientosService: jest.Mocked<MovimientosService>;

  const mockInscripcion: Partial<Inscripcion> = {
    id: 'inscripcion-uuid',
    personaId: 'persona-uuid',
    tipo: TipoInscripcion.GRUPO,
    ano: 2026,
    montoTotal: 10000,
    montoBonificado: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InscripcionesService,
        {
          provide: getRepositoryToken(Inscripcion),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            softRemove: jest.fn(),
          },
        },
        {
          provide: PersonasService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: MovimientosService,
          useValue: {
            findByRelatedEntity: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InscripcionesService>(InscripcionesService);
    repository = module.get(getRepositoryToken(Inscripcion));
    personasService = module.get(PersonasService);
    movimientosService = module.get(MovimientosService);
  });

  describe('registrarInscripcion', () => {
    it('should create inscription when valid', async () => {
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockInscripcion as Inscripcion);
      repository.save.mockResolvedValue(mockInscripcion as Inscripcion);

      const result = await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
      });

      expect(result).toEqual(mockInscripcion);
      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
    });

    it('should throw if inscription already exists for year and type', async () => {
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);

      await expect(
        service.registrarInscripcion({
          personaId: 'persona-uuid',
          tipo: TipoInscripcion.GRUPO,
          ano: 2026,
          montoTotal: 10000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if montoBonificado exceeds montoTotal', async () => {
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.registrarInscripcion({
          personaId: 'persona-uuid',
          tipo: TipoInscripcion.GRUPO,
          ano: 2026,
          montoTotal: 10000,
          montoBonificado: 15000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getMontoPagado', () => {
    it('should sum only INGRESO movements', async () => {
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 },
        { tipo: TipoMovimiento.INGRESO, monto: 3000 },
        { tipo: TipoMovimiento.EGRESO, monto: 1000 },
      ] as any);

      const result = await service.getMontoPagado('inscripcion-uuid');

      expect(result).toBe(8000);
    });
  });

  describe('getEstado', () => {
    it('should return PAGADO when fully covered', async () => {
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 10000 },
      ] as any);

      const result = await service.getEstado(mockInscripcion as Inscripcion);

      expect(result).toBe(EstadoInscripcion.PAGADO);
    });

    it('should return PARCIAL when partially covered', async () => {
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 },
      ] as any);

      const result = await service.getEstado(mockInscripcion as Inscripcion);

      expect(result).toBe(EstadoInscripcion.PARCIAL);
    });

    it('should return PENDIENTE when nothing paid', async () => {
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.getEstado(mockInscripcion as Inscripcion);

      expect(result).toBe(EstadoInscripcion.PENDIENTE);
    });

    it('should consider montoBonificado in calculation', async () => {
      const inscripcionConBonificacion = {
        ...mockInscripcion,
        montoBonificado: 5000,
      };
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 },
      ] as any);

      const result = await service.getEstado(inscripcionConBonificacion as Inscripcion);

      expect(result).toBe(EstadoInscripcion.PAGADO);
    });
  });
});
```

**Step 2: Run tests**

```bash
npm test -- src/modules/inscripciones/inscripciones.service.spec.ts
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add src/modules/inscripciones/inscripciones.service.spec.ts
git commit -m "test(inscripciones): add unit tests for InscripcionesService"
```

---

## Task 10: Verificar compilación y lint

**Step 1: Verificar TypeScript compila**

```bash
npm run build
```

Expected: No errors

**Step 2: Ejecutar lint**

```bash
npm run lint
```

Expected: No errors (o solo warnings menores)

**Step 3: Ejecutar todos los tests**

```bash
npm test
```

Expected: All tests pass

**Step 4: Commit final si hay fixes de lint**

```bash
git add -A
git commit -m "chore: fix lint issues"
```

---

## Task 11: Actualizar exports de DTOs y entidades

**Files:**
- Modify: `src/modules/inscripciones/dtos/index.ts`
- Modify: `src/modules/inscripciones/entities/index.ts`

**Step 1: Verificar exports**

`dtos/index.ts`:
```typescript
export * from './create-inscripcion.dto';
```

`entities/index.ts`:
```typescript
export * from './inscripcion.entity';
```

**Step 2: Commit si hubo cambios**

```bash
git add src/modules/inscripciones/dtos/index.ts src/modules/inscripciones/entities/index.ts
git commit -m "chore(inscripciones): update exports"
```

---

## Resumen de cambios

| Archivo | Acción |
|---------|--------|
| `src/common/enums/index.ts` | Agregar TipoInscripcion, actualizar ConceptoMovimiento |
| `src/modules/inscripciones/entities/inscripcion.entity.ts` | Agregar tipo, eliminar campos calculados |
| `src/modules/inscripciones/dtos/create-inscripcion.dto.ts` | Agregar tipo, cambiar bonificación |
| `src/modules/inscripciones/inscripciones.service.ts` | Refactorizar completamente |
| `src/modules/inscripciones/inscripciones.controller.ts` | Simplificar, eliminar endpoints de pago |
| `src/modules/inscripciones/inscripciones.module.ts` | Actualizar imports |
| `src/modules/personas/entities/persona.entity.ts` | Eliminar fueBonificado |
| `src/modules/personas/personas.service.ts` | Eliminar marcarBonificado |
| `src/modules/inscripciones/inscripciones.service.spec.ts` | Crear tests |

## Notas importantes

1. **Migración de base de datos**: Este plan no incluye migraciones de TypeORM. Antes de ejecutar en producción, generar migración con `npm run typeorm migration:generate`.

2. **Datos existentes**: Si hay inscripciones en la DB, la migración debe asignar `tipo = 'scout_argentina'` a todas las existentes.

3. **Tests E2E**: Los tests E2E existentes para inscripciones necesitarán actualizarse después de estos cambios.
