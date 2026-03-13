// src/modules/personas/services/personas-dashboard.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PersonasDashboardService } from './personas-dashboard.service';
import { PersonasService } from '../personas.service';
import { CajasService } from '../../cajas/cajas.service';
import { InscripcionesService } from '../../inscripciones/inscripciones.service';
import { CuotasService } from '../../cuotas/cuotas.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import {
  PersonaType,
  EstadoPersona,
  Rama,
  TipoInscripcion,
  EstadoInscripcion,
  EstadoCuota,
  TipoMovimiento,
  MedioPago,
  ConceptoMovimiento,
  CajaType,
} from '../../../common/enums';

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
    estado: EstadoPersona.ACTIVO,
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
    estado: EstadoPersona.ACTIVO,
    rama: Rama.UNIDAD,
    cargo: 'EDUCADOR',
  };

  const mockPersonaExterna = {
    id: 'persona-3',
    nombre: 'Pedro López',
    tipo: PersonaType.EXTERNA,
    estado: EstadoPersona.ACTIVO,
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
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(1500);
      inscripcionesService.findByPersona.mockResolvedValue([
        mockInscripcion2026,
      ] as any);
      cuotasService.findByPersona.mockResolvedValue([mockCuota2026] as any);
      movimientosService.findByCaja.mockResolvedValue([mockMovimiento] as any);

      const result = await service.getDashboard('persona-1');

      expect(result.persona.id).toBe('persona-1');
      expect(result.persona.tipo).toBe(PersonaType.PROTAGONISTA);
      expect(result.cuentaPersonal.saldo).toBe(1500);
      expect(result.documentacionPersonal).toBeDefined();
      expect(result.documentacionPersonal?.completa).toBe(false);
      expect(result.inscripciones.items).toHaveLength(1);
      expect(result.cuotas.items).toHaveLength(1);
      expect(result.ultimosMovimientos).toHaveLength(1);
    });

    it('should return dashboard for Educador without documentacionPersonal', async () => {
      personasService.findOne.mockResolvedValue(mockEducador as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      cuotasService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-2');

      expect(result.persona.tipo).toBe(PersonaType.EDUCADOR);
      expect(result.documentacionPersonal).toBeNull();
    });

    it('should throw NotFoundException if persona not found', async () => {
      personasService.findOne.mockRejectedValue(
        new NotFoundException('Persona no encontrada'),
      );

      await expect(service.getDashboard('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if persona is PersonaExterna', async () => {
      personasService.findOne.mockResolvedValue(mockPersonaExterna as any);

      await expect(service.getDashboard('persona-3')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getDashboard('persona-3')).rejects.toThrow(
        'Dashboard no disponible para PersonaExterna',
      );
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
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
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
      expect(result.inscripciones.items.map((i) => i.ano)).toContain(2026);
      expect(result.inscripciones.items.map((i) => i.ano)).toContain(2024);
      expect(result.inscripciones.items.map((i) => i.ano)).not.toContain(2025);
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
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      cuotasService.findByPersona.mockResolvedValue([
        mockCuota2026,
        cuota2025SinDeuda,
      ] as any);
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
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      cuotasService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue(movements as any);

      const result = await service.getDashboard('persona-1');

      expect(result.ultimosMovimientos).toHaveLength(5);
    });

    it('should calculate total debt correctly', async () => {
      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([
        mockInscripcion2026,
      ] as any);
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
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
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
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([
        mockInscripcion2026,
        inscripcionGrupo,
      ] as any);
      cuotasService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      const scoutArgentina = result.inscripciones.items.find(
        (i) => i.tipo === TipoInscripcion.SCOUT_ARGENTINA,
      );
      const grupo = result.inscripciones.items.find(
        (i) => i.tipo === TipoInscripcion.GRUPO,
      );

      expect(scoutArgentina?.autorizaciones).toBeDefined();
      expect(grupo?.autorizaciones).toBeUndefined();
    });
  });
});
