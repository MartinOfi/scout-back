# Persona Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `GET /personas/:id/dashboard` endpoint that consolidates financial and administrative data for Protagonistas/Educadores.

**Architecture:** New `PersonasDashboardService` orchestrates existing services (PersonasService, CajasService, InscripcionesService, CuotasService, MovimientosService) to assemble a unified dashboard DTO.

**Tech Stack:** NestJS, TypeORM, class-validator, Jest

---

## File Structure

| File | Purpose |
|------|---------|
| `src/modules/personas/dtos/persona-dashboard.dto.ts` | **CREATE** - Response DTO with all dashboard data |
| `src/modules/personas/services/personas-dashboard.service.ts` | **CREATE** - Dashboard service |
| `src/modules/personas/services/personas-dashboard.service.spec.ts` | **CREATE** - Unit tests |
| `src/modules/personas/personas.module.ts` | **MODIFY** - Register new service |
| `src/modules/personas/controllers/personas.controller.ts` | **MODIFY** - Add dashboard endpoint |

---

## Chunk 1: DTO Creation

### Task 1: Create persona-dashboard.dto.ts

**Files:**
- Create: `src/modules/personas/dtos/persona-dashboard.dto.ts`

- [ ] **Step 1.1: Create the DTO file with all interfaces**

```typescript
// src/modules/personas/dtos/persona-dashboard.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoInscripcion, EstadoInscripcion, TipoMovimiento, MedioPago, PersonaType, PersonaState, Rama, CargoEducador, EstadoCuota } from '../../../common/enums';

export class PersonaDashboardPersonaDto {
  @ApiProperty({ description: 'UUID de la persona' })
  id: string;

  @ApiProperty({ description: 'Nombre completo' })
  nombre: string;

  @ApiProperty({ enum: ['Protagonista', 'Educador'] })
  tipo: 'Protagonista' | 'Educador';

  @ApiProperty({ enum: PersonaState })
  estado: PersonaState;

  @ApiPropertyOptional({ enum: Rama, nullable: true })
  rama: Rama | null;

  @ApiPropertyOptional({ enum: CargoEducador })
  cargo?: CargoEducador;
}

export class CuentaPersonalDto {
  @ApiProperty({ description: 'UUID de la caja personal' })
  id: string;

  @ApiProperty({ description: 'Saldo calculado desde movimientos' })
  saldo: number;
}

export class DocumentacionPersonalDto {
  @ApiProperty()
  partidaNacimiento: boolean;

  @ApiProperty()
  dni: boolean;

  @ApiProperty()
  dniPadres: boolean;

  @ApiProperty()
  carnetObraSocial: boolean;

  @ApiProperty({ description: 'true si todos los documentos están completos' })
  completa: boolean;
}

export class AutorizacionesInscripcionDto {
  @ApiProperty()
  declaracionDeSalud: boolean;

  @ApiProperty()
  autorizacionDeImagen: boolean;

  @ApiProperty()
  salidasCercanas: boolean;

  @ApiProperty()
  autorizacionIngreso: boolean;

  @ApiProperty()
  certificadoAptitudFisica: boolean;

  @ApiProperty({ description: 'true si todas las autorizaciones están completas' })
  completas: boolean;
}

export class InscripcionDashboardItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: TipoInscripcion })
  tipo: TipoInscripcion;

  @ApiProperty()
  ano: number;

  @ApiProperty()
  montoTotal: number;

  @ApiProperty()
  montoBonificado: number;

  @ApiProperty()
  montoPagado: number;

  @ApiProperty()
  saldoPendiente: number;

  @ApiProperty({ enum: EstadoInscripcion })
  estado: EstadoInscripcion;

  @ApiPropertyOptional({ type: AutorizacionesInscripcionDto })
  autorizaciones?: AutorizacionesInscripcionDto;
}

export class InscripcionesResumenDto {
  @ApiProperty({ description: 'Suma de saldos pendientes' })
  total: number;

  @ApiProperty({ description: 'Cantidad de inscripciones con deuda' })
  cantidad: number;
}

export class InscripcionesDashboardDto {
  @ApiProperty({ type: InscripcionesResumenDto })
  resumen: InscripcionesResumenDto;

  @ApiProperty({ type: [InscripcionDashboardItemDto] })
  items: InscripcionDashboardItemDto[];
}

export class CuotaDashboardItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  ano: number;

  @ApiProperty()
  montoTotal: number;

  @ApiProperty()
  montoPagado: number;

  @ApiProperty()
  saldoPendiente: number;

  @ApiProperty({ enum: EstadoCuota })
  estado: EstadoCuota;
}

export class CuotasResumenDto {
  @ApiProperty({ description: 'Suma de saldos pendientes' })
  total: number;

  @ApiProperty({ description: 'Cantidad de cuotas con deuda' })
  cantidad: number;
}

export class CuotasDashboardDto {
  @ApiProperty({ type: CuotasResumenDto })
  resumen: CuotasResumenDto;

  @ApiProperty({ type: [CuotaDashboardItemDto] })
  items: CuotaDashboardItemDto[];
}

export class DeudaTotalDto {
  @ApiProperty({ description: 'Total de inscripciones + cuotas' })
  total: number;

  @ApiProperty()
  inscripciones: number;

  @ApiProperty()
  cuotas: number;
}

export class MovimientoDashboardDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Fecha ISO 8601' })
  fecha: string;

  @ApiProperty({ enum: TipoMovimiento })
  tipo: TipoMovimiento;

  @ApiProperty()
  concepto: string;

  @ApiProperty()
  monto: number;

  @ApiProperty({ enum: MedioPago })
  medioPago: MedioPago;
}

export class PersonaDashboardDto {
  @ApiProperty({ type: PersonaDashboardPersonaDto })
  persona: PersonaDashboardPersonaDto;

  @ApiProperty({ type: CuentaPersonalDto })
  cuentaPersonal: CuentaPersonalDto;

  @ApiPropertyOptional({ type: DocumentacionPersonalDto, nullable: true })
  documentacionPersonal?: DocumentacionPersonalDto | null;

  @ApiProperty({ type: InscripcionesDashboardDto })
  inscripciones: InscripcionesDashboardDto;

  @ApiProperty({ type: CuotasDashboardDto })
  cuotas: CuotasDashboardDto;

  @ApiProperty({ type: DeudaTotalDto })
  deudaTotal: DeudaTotalDto;

  @ApiProperty({ type: [MovimientoDashboardDto] })
  ultimosMovimientos: MovimientoDashboardDto[];
}
```

- [ ] **Step 1.2: Export from dtos/index.ts**

Add to `src/modules/personas/dtos/index.ts`:

```typescript
export * from './persona-dashboard.dto';
```

- [ ] **Step 1.3: Verify TypeScript compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 1.4: Commit**

```bash
git add src/modules/personas/dtos/persona-dashboard.dto.ts src/modules/personas/dtos/index.ts
git commit -m "feat(personas): add PersonaDashboardDto"
```

---

## Chunk 2: Service Implementation (TDD)

### Task 2: Write failing unit tests

**Files:**
- Create: `src/modules/personas/services/personas-dashboard.service.spec.ts`

- [ ] **Step 2.1: Create test file with mock setup**

```typescript
// src/modules/personas/services/personas-dashboard.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PersonasDashboardService } from './personas-dashboard.service';
import { PersonasService } from '../personas.service';
import { CajasService } from '../../cajas/cajas.service';
import { InscripcionesService } from '../../inscripciones/inscripciones.service';
import { CuotasService } from '../../cuotas/cuotas.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { PersonaType, PersonaState, Rama, TipoInscripcion, EstadoInscripcion, EstadoCuota, TipoMovimiento, MedioPago, ConceptoMovimiento, CajaType } from '../../../common/enums';

describe('PersonasDashboardService', () => {
  let service: PersonasDashboardService;
  let personasService: jest.Mocked<PersonasService>;
  let cajasService: jest.Mocked<CajasService>;
  let inscripcionesService: jest.Mocked<InscripcionesService>;
  let cuotasService: jest.Mocked<CuotasService>;
  let movimientosService: jest.Mocked<MovimientosService>;

  const mockProtagonista = {
    id: 'persona-1',
    nombre: 'Juan Pérez',
    tipo: PersonaType.PROTAGONISTA,
    estado: PersonaState.ACTIVO,
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: false,
    carnetObraSocial: true,
  };

  const mockEducador = {
    id: 'persona-2',
    nombre: 'María García',
    tipo: PersonaType.EDUCADOR,
    estado: PersonaState.ACTIVO,
    rama: Rama.UNIDAD,
    cargo: 'EDUCADOR',
  };

  const mockPersonaExterna = {
    id: 'persona-3',
    nombre: 'Pedro López',
    tipo: PersonaType.PERSONA_EXTERNA,
    estado: PersonaState.ACTIVO,
    rama: null,
  };

  const mockCajaPersonal = {
    id: 'caja-1',
    tipo: CajaType.PERSONAL,
    propietarioId: 'persona-1',
  };

  const mockInscripcion2026 = {
    id: 'inscripcion-1',
    personaId: 'persona-1',
    tipo: TipoInscripcion.SCOUT_ARGENTINA,
    ano: 2026,
    montoTotal: 10000,
    montoBonificado: 0,
    montoPagado: 5000,
    saldoPendiente: 5000,
    estado: EstadoInscripcion.PARCIAL,
    declaracionDeSalud: true,
    autorizacionDeImagen: true,
    salidasCercanas: false,
    autorizacionIngreso: true,
    certificadoAptitudFisica: false,
  };

  const mockCuota2026 = {
    id: 'cuota-1',
    personaId: 'persona-1',
    nombre: 'Cuota Marzo 2026',
    ano: 2026,
    montoTotal: 2000,
    montoPagado: 0,
    estado: EstadoCuota.PENDIENTE,
  };

  const mockMovimiento = {
    id: 'mov-1',
    fecha: new Date('2026-03-01'),
    tipo: TipoMovimiento.INGRESO,
    concepto: ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA,
    descripcion: 'Pago inscripción',
    monto: 5000,
    medioPago: MedioPago.EFECTIVO,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonasDashboardService,
        {
          provide: PersonasService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: CajasService,
          useValue: {
            findCajaPersonal: jest.fn(),
            getOrCreateCajaPersonal: jest.fn(),
          },
        },
        {
          provide: InscripcionesService,
          useValue: {
            findByPersona: jest.fn(),
          },
        },
        {
          provide: CuotasService,
          useValue: {
            findByPersona: jest.fn(),
          },
        },
        {
          provide: MovimientosService,
          useValue: {
            findByCaja: jest.fn(),
            calcularSaldo: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PersonasDashboardService>(PersonasDashboardService);
    personasService = module.get(PersonasService);
    cajasService = module.get(CajasService);
    inscripcionesService = module.get(InscripcionesService);
    cuotasService = module.get(CuotasService);
    movimientosService = module.get(MovimientosService);
  });

  describe('getDashboard', () => {
    it('should return complete dashboard for Protagonista', async () => {
      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(mockCajaPersonal as any);
      movimientosService.calcularSaldo.mockResolvedValue(1500);
      inscripcionesService.findByPersona.mockResolvedValue([mockInscripcion2026] as any);
      cuotasService.findByPersona.mockResolvedValue([mockCuota2026] as any);
      movimientosService.findByCaja.mockResolvedValue([mockMovimiento] as any);

      const result = await service.getDashboard('persona-1');

      expect(result.persona.id).toBe('persona-1');
      expect(result.persona.tipo).toBe('Protagonista');
      expect(result.cuentaPersonal.saldo).toBe(1500);
      expect(result.documentacionPersonal).toBeDefined();
      expect(result.documentacionPersonal?.completa).toBe(false);
      expect(result.inscripciones.items).toHaveLength(1);
      expect(result.cuotas.items).toHaveLength(1);
      expect(result.ultimosMovimientos).toHaveLength(1);
    });

    it('should return dashboard for Educador without documentacionPersonal', async () => {
      personasService.findOne.mockResolvedValue(mockEducador as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(mockCajaPersonal as any);
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      cuotasService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-2');

      expect(result.persona.tipo).toBe('Educador');
      expect(result.documentacionPersonal).toBeNull();
    });

    it('should throw NotFoundException if persona not found', async () => {
      personasService.findOne.mockRejectedValue(new NotFoundException('Persona no encontrada'));

      await expect(service.getDashboard('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if persona is PersonaExterna', async () => {
      personasService.findOne.mockResolvedValue(mockPersonaExterna as any);

      await expect(service.getDashboard('persona-3')).rejects.toThrow(BadRequestException);
      await expect(service.getDashboard('persona-3')).rejects.toThrow('Dashboard no disponible para PersonaExterna');
    });

    it('should filter inscriptions to current year + past years with debt', async () => {
      const inscripcion2025SinDeuda = {
        ...mockInscripcion2026,
        id: 'inscripcion-2025',
        ano: 2025,
        saldoPendiente: 0,
        estado: EstadoInscripcion.PAGADO,
      };
      const inscripcion2024ConDeuda = {
        ...mockInscripcion2026,
        id: 'inscripcion-2024',
        ano: 2024,
        saldoPendiente: 1000,
      };

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(mockCajaPersonal as any);
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([
        mockInscripcion2026,
        inscripcion2025SinDeuda,
        inscripcion2024ConDeuda,
      ] as any);
      cuotasService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      // Should include 2026 (current) and 2024 (has debt), exclude 2025 (no debt, not current)
      expect(result.inscripciones.items).toHaveLength(2);
      expect(result.inscripciones.items.map(i => i.ano)).toContain(2026);
      expect(result.inscripciones.items.map(i => i.ano)).toContain(2024);
      expect(result.inscripciones.items.map(i => i.ano)).not.toContain(2025);
    });

    it('should filter cuotas to current year + past years with debt', async () => {
      const cuota2025SinDeuda = {
        ...mockCuota2026,
        id: 'cuota-2025',
        ano: 2025,
        montoPagado: 2000,
        estado: EstadoCuota.PAGADO,
      };

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(mockCajaPersonal as any);
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      cuotasService.findByPersona.mockResolvedValue([mockCuota2026, cuota2025SinDeuda] as any);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      // Should include 2026 (current), exclude 2025 (no debt)
      expect(result.cuotas.items).toHaveLength(1);
      expect(result.cuotas.items[0].ano).toBe(2026);
    });

    it('should limit movements to last 5', async () => {
      const movements = Array.from({ length: 10 }, (_, i) => ({
        ...mockMovimiento,
        id: `mov-${i}`,
        fecha: new Date(`2026-03-${10 - i}`),
      }));

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(mockCajaPersonal as any);
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      cuotasService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue(movements as any);

      const result = await service.getDashboard('persona-1');

      expect(result.ultimosMovimientos).toHaveLength(5);
    });

    it('should calculate total debt correctly', async () => {
      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(mockCajaPersonal as any);
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([mockInscripcion2026] as any);
      cuotasService.findByPersona.mockResolvedValue([mockCuota2026] as any);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      // Inscripcion: 5000, Cuota: 2000
      expect(result.deudaTotal.inscripciones).toBe(5000);
      expect(result.deudaTotal.cuotas).toBe(2000);
      expect(result.deudaTotal.total).toBe(7000);
    });

    it('should mark documentation as complete when all docs are present', async () => {
      const protagonistaCompleto = {
        ...mockProtagonista,
        partidaNacimiento: true,
        dni: true,
        dniPadres: true,
        carnetObraSocial: true,
      };

      personasService.findOne.mockResolvedValue(protagonistaCompleto as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(mockCajaPersonal as any);
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      cuotasService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      expect(result.documentacionPersonal?.completa).toBe(true);
    });

    it('should include autorizaciones for SCOUT_ARGENTINA inscriptions only', async () => {
      const inscripcionGrupo = {
        ...mockInscripcion2026,
        id: 'inscripcion-grupo',
        tipo: TipoInscripcion.GRUPO,
      };

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(mockCajaPersonal as any);
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([mockInscripcion2026, inscripcionGrupo] as any);
      cuotasService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      const scoutArgentina = result.inscripciones.items.find(i => i.tipo === TipoInscripcion.SCOUT_ARGENTINA);
      const grupo = result.inscripciones.items.find(i => i.tipo === TipoInscripcion.GRUPO);

      expect(scoutArgentina?.autorizaciones).toBeDefined();
      expect(grupo?.autorizaciones).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern=personas-dashboard.service.spec.ts`
Expected: FAIL (Cannot find module './personas-dashboard.service')

- [ ] **Step 2.3: Commit failing tests**

```bash
git add src/modules/personas/services/personas-dashboard.service.spec.ts
git commit -m "test(personas): add failing tests for PersonasDashboardService"
```

### Task 3: Implement PersonasDashboardService

**Files:**
- Create: `src/modules/personas/services/personas-dashboard.service.ts`

- [ ] **Step 3.1: Create service implementation**

```typescript
// src/modules/personas/services/personas-dashboard.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PersonasService } from '../personas.service';
import { CajasService } from '../../cajas/cajas.service';
import { InscripcionesService } from '../../inscripciones/inscripciones.service';
import { CuotasService } from '../../cuotas/cuotas.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import {
  PersonaDashboardDto,
  InscripcionDashboardItemDto,
  CuotaDashboardItemDto,
  MovimientoDashboardDto,
  AutorizacionesInscripcionDto,
} from '../dtos/persona-dashboard.dto';
import { PersonaType, TipoInscripcion, EstadoCuota } from '../../../common/enums';

@Injectable()
export class PersonasDashboardService {
  constructor(
    @Inject(forwardRef(() => PersonasService))
    private readonly personasService: PersonasService,
    @Inject(forwardRef(() => CajasService))
    private readonly cajasService: CajasService,
    @Inject(forwardRef(() => InscripcionesService))
    private readonly inscripcionesService: InscripcionesService,
    @Inject(forwardRef(() => CuotasService))
    private readonly cuotasService: CuotasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
  ) {}

  async getDashboard(personaId: string): Promise<PersonaDashboardDto> {
    // 1. Get persona and validate type
    const persona = await this.personasService.findOne(personaId);

    if (persona.tipo === PersonaType.PERSONA_EXTERNA) {
      throw new BadRequestException('Dashboard no disponible para PersonaExterna');
    }

    // 2. Get or create personal account
    const cajaPersonal = await this.cajasService.getOrCreateCajaPersonal(personaId);

    // 3. Parallel data fetching
    const [saldo, inscripciones, cuotas, movimientos] = await Promise.all([
      this.movimientosService.calcularSaldo(cajaPersonal.id),
      this.inscripcionesService.findByPersona(personaId),
      this.cuotasService.findByPersona(personaId),
      this.movimientosService.findByCaja(cajaPersonal.id),
    ]);

    const currentYear = new Date().getFullYear();

    // 4. Filter inscriptions: current year + past with debt
    const filteredInscripciones = inscripciones.filter(
      (i) => i.ano === currentYear || i.saldoPendiente > 0,
    );

    // 5. Filter cuotas: current year + past with debt
    const filteredCuotas = cuotas.filter((c) => {
      const saldoPendiente = c.montoTotal - c.montoPagado;
      return c.ano === currentYear || saldoPendiente > 0;
    });

    // 6. Map inscriptions to dashboard items
    const inscripcionItems: InscripcionDashboardItemDto[] = filteredInscripciones.map((i) => {
      const item: InscripcionDashboardItemDto = {
        id: i.id,
        tipo: i.tipo,
        ano: i.ano,
        montoTotal: i.montoTotal,
        montoBonificado: i.montoBonificado,
        montoPagado: i.montoPagado,
        saldoPendiente: i.saldoPendiente,
        estado: i.estado,
      };

      // Only include autorizaciones for SCOUT_ARGENTINA
      if (i.tipo === TipoInscripcion.SCOUT_ARGENTINA) {
        const autorizaciones: AutorizacionesInscripcionDto = {
          declaracionDeSalud: i.declaracionDeSalud,
          autorizacionDeImagen: i.autorizacionDeImagen,
          salidasCercanas: i.salidasCercanas,
          autorizacionIngreso: i.autorizacionIngreso,
          certificadoAptitudFisica: i.certificadoAptitudFisica,
          completas:
            i.declaracionDeSalud &&
            i.autorizacionDeImagen &&
            i.salidasCercanas &&
            i.autorizacionIngreso &&
            i.certificadoAptitudFisica,
        };
        item.autorizaciones = autorizaciones;
      }

      return item;
    });

    // 7. Map cuotas to dashboard items
    const cuotaItems: CuotaDashboardItemDto[] = filteredCuotas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      ano: c.ano,
      montoTotal: Number(c.montoTotal),
      montoPagado: Number(c.montoPagado),
      saldoPendiente: Number(c.montoTotal) - Number(c.montoPagado),
      estado: c.estado,
    }));

    // 8. Calculate debt totals
    const deudaInscripciones = inscripcionItems.reduce((sum, i) => sum + i.saldoPendiente, 0);
    const deudaCuotas = cuotaItems.reduce((sum, c) => sum + c.saldoPendiente, 0);

    // 9. Map movements (last 5)
    const ultimosMovimientos: MovimientoDashboardDto[] = movimientos.slice(0, 5).map((m) => ({
      id: m.id,
      fecha: m.fecha.toISOString(),
      tipo: m.tipo,
      concepto: m.concepto,
      monto: Number(m.monto),
      medioPago: m.medioPago,
    }));

    // 10. Build documentacion personal (Protagonista only)
    const documentacionPersonal =
      persona.tipo === PersonaType.PROTAGONISTA
        ? {
            partidaNacimiento: (persona as any).partidaNacimiento ?? false,
            dni: (persona as any).dni ?? false,
            dniPadres: (persona as any).dniPadres ?? false,
            carnetObraSocial: (persona as any).carnetObraSocial ?? false,
            completa:
              ((persona as any).partidaNacimiento ?? false) &&
              ((persona as any).dni ?? false) &&
              ((persona as any).dniPadres ?? false) &&
              ((persona as any).carnetObraSocial ?? false),
          }
        : null;

    // 11. Assemble response
    return {
      persona: {
        id: persona.id,
        nombre: persona.nombre,
        tipo: persona.tipo === PersonaType.PROTAGONISTA ? 'Protagonista' : 'Educador',
        estado: persona.estado,
        rama: persona.rama ?? null,
        cargo: persona.tipo === PersonaType.EDUCADOR ? (persona as any).cargo : undefined,
      },
      cuentaPersonal: {
        id: cajaPersonal.id,
        saldo,
      },
      documentacionPersonal,
      inscripciones: {
        resumen: {
          total: deudaInscripciones,
          cantidad: inscripcionItems.filter((i) => i.saldoPendiente > 0).length,
        },
        items: inscripcionItems,
      },
      cuotas: {
        resumen: {
          total: deudaCuotas,
          cantidad: cuotaItems.filter((c) => c.saldoPendiente > 0).length,
        },
        items: cuotaItems,
      },
      deudaTotal: {
        total: deudaInscripciones + deudaCuotas,
        inscripciones: deudaInscripciones,
        cuotas: deudaCuotas,
      },
      ultimosMovimientos,
    };
  }
}
```

- [ ] **Step 3.2: Run tests to verify they pass**

Run: `npm test -- --testPathPattern=personas-dashboard.service.spec.ts`
Expected: PASS (all 10 tests)

- [ ] **Step 3.3: Commit passing implementation**

```bash
git add src/modules/personas/services/personas-dashboard.service.ts
git commit -m "feat(personas): implement PersonasDashboardService"
```

---

## Chunk 3: Module Integration

### Task 4: Register service in module

**Files:**
- Modify: `src/modules/personas/personas.module.ts`

- [ ] **Step 4.1: Add PersonasDashboardService to providers and exports**

Add import at top:
```typescript
import { PersonasDashboardService } from './services/personas-dashboard.service';
```

Add to `providers` array:
```typescript
PersonasDashboardService,
```

Add to `exports` array:
```typescript
PersonasDashboardService,
```

- [ ] **Step 4.2: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 4.3: Commit**

```bash
git add src/modules/personas/personas.module.ts
git commit -m "feat(personas): register PersonasDashboardService in module"
```

### Task 5: Add dashboard endpoint to controller

**Files:**
- Modify: `src/modules/personas/controllers/personas.controller.ts`

- [ ] **Step 5.1: Import PersonasDashboardService and DTO**

Add imports:
```typescript
import { PersonasDashboardService } from '../services/personas-dashboard.service';
import { PersonaDashboardDto } from '../dtos/persona-dashboard.dto';
```

- [ ] **Step 5.2: Inject service in constructor**

Add to constructor:
```typescript
private readonly dashboardService: PersonasDashboardService,
```

- [ ] **Step 5.3: Add dashboard endpoint**

Add method (before the `@Get(':id')` method to avoid route conflicts):
```typescript
@Get(':id/dashboard')
@ApiOperation({ summary: 'Obtener dashboard consolidado de persona' })
@ApiParam({ name: 'id', type: 'string', description: 'UUID de la persona' })
@ApiResponse({
  status: 200,
  description: 'Dashboard de la persona',
  type: PersonaDashboardDto,
})
@ApiResponse({ status: 400, description: 'Persona es PersonaExterna' })
@ApiResponse({ status: 404, description: 'Persona no encontrada' })
async getDashboard(
  @Param('id', ParseUUIDPipe) id: string,
): Promise<PersonaDashboardDto> {
  return this.dashboardService.getDashboard(id);
}
```

- [ ] **Step 5.4: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 5.5: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5.6: Commit**

```bash
git add src/modules/personas/controllers/personas.controller.ts
git commit -m "feat(personas): add GET /personas/:id/dashboard endpoint"
```

---

## Chunk 4: Manual Verification

### Task 6: Test endpoint manually

- [ ] **Step 6.1: Start development server**

Run: `npm run start:dev`

- [ ] **Step 6.2: Access Swagger docs**

Open: `http://localhost:3001/api/docs`
Navigate to: Personas → GET /api/v1/personas/{id}/dashboard

- [ ] **Step 6.3: Test with valid Protagonista ID**

Use a valid Protagonista UUID from the database.
Expected: 200 response with full dashboard including `documentacionPersonal`

- [ ] **Step 6.4: Test with valid Educador ID**

Use a valid Educador UUID from the database.
Expected: 200 response with `documentacionPersonal: null`

- [ ] **Step 6.5: Test with PersonaExterna ID**

Use a valid PersonaExterna UUID from the database.
Expected: 400 response with message "Dashboard no disponible para PersonaExterna"

- [ ] **Step 6.6: Test with non-existent ID**

Use a random UUID that doesn't exist.
Expected: 404 response with message "Persona no encontrada"

- [ ] **Step 6.7: Final commit with all changes**

```bash
git add .
git commit -m "feat(personas): complete persona dashboard implementation

- Add PersonaDashboardDto with full response structure
- Implement PersonasDashboardService with business logic
- Add GET /personas/:id/dashboard endpoint
- Filter inscriptions/cuotas to current year + debts
- Limit movements to last 5
- Calculate debt totals
- Include personal documentation for Protagonista only
- Include authorization documents for SCOUT_ARGENTINA inscriptions"
```

---

## Summary

**Total Tasks:** 6
**Total Steps:** ~25

**New Files:**
1. `src/modules/personas/dtos/persona-dashboard.dto.ts`
2. `src/modules/personas/services/personas-dashboard.service.ts`
3. `src/modules/personas/services/personas-dashboard.service.spec.ts`

**Modified Files:**
1. `src/modules/personas/dtos/index.ts`
2. `src/modules/personas/personas.module.ts`
3. `src/modules/personas/controllers/personas.controller.ts`

**Dependencies:** Uses existing services (PersonasService, CajasService, InscripcionesService, CuotasService, MovimientosService) via forwardRef injection pattern already established in the codebase.
