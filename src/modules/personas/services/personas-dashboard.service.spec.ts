// src/modules/personas/services/personas-dashboard.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PersonasDashboardService } from './personas-dashboard.service';
import { PersonasService } from '../personas.service';
import { CajasService } from '../../cajas/cajas.service';
import { InscripcionesService } from '../../inscripciones/inscripciones.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { CampamentoParticipante } from '../../campamentos/entities/campamento-participante.entity';
import {
  PersonaType,
  EstadoPersona,
  Rama,
  TipoInscripcion,
  EstadoInscripcion,
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
  let movimientosService: jest.Mocked<MovimientosService>;
  let participacionesQb: { getMany: jest.Mock } & Record<string, jest.Mock>;

  /** Sets the participaciones returned by the (mocked) repository query builder. */
  const setParticipaciones = (list: unknown[]): void => {
    participacionesQb.getMany.mockResolvedValue(list);
  };

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

  const mockParticipacion2026 = {
    campamentoId: 'camp-1',
    personaId: 'persona-1',
    autorizacionEntregada: false,
    campamento: {
      id: 'camp-1',
      nombre: 'Campamento Primavera',
      costoPorPersona: 8000,
      fechaInicio: new Date('2026-09-20'),
    },
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
    participacionesQb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

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
          provide: MovimientosService,
          useValue: {
            findByCaja: jest.fn(),
            findByResponsable: jest.fn(),
            calcularSaldo: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CampamentoParticipante),
          useValue: {
            createQueryBuilder: jest.fn(() => participacionesQb),
          },
        },
      ],
    }).compile();

    service = module.get<PersonasDashboardService>(PersonasDashboardService);
    personasService = module.get(PersonasService);
    cajasService = module.get(CajasService);
    inscripcionesService = module.get(InscripcionesService);
    movimientosService = module.get(MovimientosService);

    // Default: persona has no movements where they are responsable.
    // Tests that exercise this source override it explicitly.
    movimientosService.findByResponsable.mockResolvedValue([]);
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
      setParticipaciones([mockParticipacion2026]);
      movimientosService.findByCaja.mockResolvedValue([mockMovimiento] as any);

      const result = await service.getDashboard('persona-1');

      expect(result.persona.id).toBe('persona-1');
      expect(result.persona.tipo).toBe(PersonaType.PROTAGONISTA);
      expect(result.cuentaPersonal.saldo).toBe(1500);
      expect(result.documentacionPersonal).toBeDefined();
      expect(result.documentacionPersonal?.completa).toBe(false);
      expect(result.inscripciones.items).toHaveLength(1);
      expect(result.campamentos.items).toHaveLength(1);
      expect(result.ultimosMovimientos).toHaveLength(1);
    });

    it('should return dashboard for Educador without documentacionPersonal', async () => {
      personasService.findOne.mockResolvedValue(mockEducador as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
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
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      // Should include 2026 (current) and 2024 (has debt), exclude 2025 (no debt, not current)
      expect(result.inscripciones.items).toHaveLength(2);
      expect(result.inscripciones.items.map((i) => i.ano)).toContain(2026);
      expect(result.inscripciones.items.map((i) => i.ano)).toContain(2024);
      expect(result.inscripciones.items.map((i) => i.ano)).not.toContain(2025);
    });

    it('should filter campamentos to current year + past years with debt', async () => {
      const participacion2025Pagada = {
        campamentoId: 'camp-2025',
        personaId: 'persona-1',
        autorizacionEntregada: true,
        campamento: {
          id: 'camp-2025',
          nombre: 'Campamento Invierno',
          costoPorPersona: 6000,
          fechaInicio: new Date('2025-07-15'),
        },
      };

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([]);
      // Past camp is fully paid -> excluded; current-year camp has no payment -> included.
      movimientosService.findByResponsable.mockResolvedValue([
        {
          id: 'pago-camp-2025',
          fecha: new Date('2025-07-01'),
          createdAt: new Date('2025-07-01'),
          tipo: TipoMovimiento.INGRESO,
          concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
          campamentoId: 'camp-2025',
          monto: 6000,
          medioPago: MedioPago.EFECTIVO,
        },
      ] as any);
      setParticipaciones([mockParticipacion2026, participacion2025Pagada]);

      const result = await service.getDashboard('persona-1');

      expect(result.campamentos.items).toHaveLength(1);
      expect(result.campamentos.items[0].ano).toBe(2026);
    });

    it('should include movements where persona is responsable even if they live in another caja (e.g. inscription paid into caja grupo)', async () => {
      // Reproduces the dashboard bug: inscription/cuota payments are recorded in
      // the caja grupo with responsableId = persona, NOT in the personal caja.
      const movEnCajaGrupo = {
        id: 'mov-grupo-1',
        fecha: new Date('2026-03-21'),
        createdAt: new Date('2026-03-21'),
        tipo: TipoMovimiento.INGRESO,
        concepto: ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA,
        descripcion: 'Pago inscripción scout_argentina 2026',
        monto: 23000,
        medioPago: MedioPago.EFECTIVO,
      };

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      // Personal caja is empty (typical protagonista paying cash/transfer).
      movimientosService.findByCaja.mockResolvedValue([]);
      movimientosService.findByResponsable.mockResolvedValue([
        movEnCajaGrupo,
      ] as any);

      const result = await service.getDashboard('persona-1');

      expect(result.ultimosMovimientos).toHaveLength(1);
      expect(result.ultimosMovimientos[0].id).toBe('mov-grupo-1');
    });

    it('should exclude recupero de costo movements (internal group accounting, not relevant to the persona)', async () => {
      const recuperoCosto = {
        id: 'mov-recupero',
        fecha: new Date('2026-04-01'),
        createdAt: new Date('2026-04-01'),
        tipo: TipoMovimiento.INGRESO,
        concepto: ConceptoMovimiento.EVENTO_VENTA_RECUPERO_COSTO,
        monto: 1500,
        medioPago: MedioPago.EFECTIVO,
      };
      const ventaIngreso = {
        id: 'mov-venta',
        fecha: new Date('2026-04-01'),
        createdAt: new Date('2026-04-01'),
        tipo: TipoMovimiento.INGRESO,
        concepto: ConceptoMovimiento.EVENTO_VENTA_INGRESO,
        monto: 500,
        medioPago: MedioPago.EFECTIVO,
      };

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([ventaIngreso] as any);
      movimientosService.findByResponsable.mockResolvedValue([
        recuperoCosto,
        ventaIngreso,
      ] as any);

      const result = await service.getDashboard('persona-1');

      expect(result.ultimosMovimientos.map((m) => m.id)).toEqual(['mov-venta']);
    });

    it('should deduplicate movements present in both responsable and personal caja sources', async () => {
      // uso_saldo_personal egresos live in the personal caja AND have
      // responsableId = persona, so they appear in both queries.
      const movCompartido = {
        id: 'mov-shared',
        fecha: new Date('2026-03-15'),
        createdAt: new Date('2026-03-15'),
        tipo: TipoMovimiento.EGRESO,
        concepto: ConceptoMovimiento.USO_SALDO_PERSONAL,
        descripcion: 'Uso de saldo personal',
        monto: 1000,
        medioPago: MedioPago.SALDO_PERSONAL,
      };

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([movCompartido] as any);
      movimientosService.findByResponsable.mockResolvedValue([
        movCompartido,
      ] as any);

      const result = await service.getDashboard('persona-1');

      expect(result.ultimosMovimientos).toHaveLength(1);
    });

    it('should order merged movements by fecha descending', async () => {
      const movViejo = {
        id: 'mov-viejo',
        fecha: new Date('2026-01-10'),
        createdAt: new Date('2026-01-10'),
        tipo: TipoMovimiento.INGRESO,
        concepto: ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA,
        monto: 5000,
        medioPago: MedioPago.EFECTIVO,
      };
      const movNuevo = {
        id: 'mov-nuevo',
        fecha: new Date('2026-05-01'),
        createdAt: new Date('2026-05-01'),
        tipo: TipoMovimiento.EGRESO,
        concepto: ConceptoMovimiento.USO_SALDO_PERSONAL,
        monto: 1000,
        medioPago: MedioPago.SALDO_PERSONAL,
      };

      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([]);
      movimientosService.findByCaja.mockResolvedValue([movNuevo] as any);
      movimientosService.findByResponsable.mockResolvedValue([movViejo] as any);

      const result = await service.getDashboard('persona-1');

      expect(result.ultimosMovimientos.map((m) => m.id)).toEqual([
        'mov-nuevo',
        'mov-viejo',
      ]);
    });

    it('should return all movements (no limit), most recent first', async () => {
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
      movimientosService.findByCaja.mockResolvedValue(movements as any);

      const result = await service.getDashboard('persona-1');

      expect(result.ultimosMovimientos).toHaveLength(10);
      expect(result.ultimosMovimientos[0].id).toBe('mov-0');
    });

    it('should calculate total debt correctly (inscripciones + campamentos)', async () => {
      personasService.findOne.mockResolvedValue(mockProtagonista as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([
        mockInscripcion2026,
      ] as any);
      setParticipaciones([mockParticipacion2026]);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      // Inscripcion: 5000, Campamento: 8000 (sin pagos)
      expect(result.deudaTotal.inscripciones).toBe(5000);
      expect(result.deudaTotal.campamentos).toBe(8000);
      expect(result.deudaTotal.total).toBe(13000);
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

    it('should exempt Rovers from imagen, ingreso y salidas cercanas autorizaciones', async () => {
      const rover = {
        ...mockProtagonista,
        rama: Rama.ROVERS,
      };
      const inscripcionSinPapeles = {
        ...mockInscripcion2026,
        autorizacionDeImagen: false,
        autorizacionIngreso: false,
        salidasCercanas: false,
        declaracionDeSalud: true,
        certificadoAptitudFisica: true,
      };

      personasService.findOne.mockResolvedValue(rover as any);
      cajasService.getOrCreateCajaPersonal.mockResolvedValue(
        mockCajaPersonal as any,
      );
      movimientosService.calcularSaldo.mockResolvedValue(0);
      inscripcionesService.findByPersona.mockResolvedValue([
        inscripcionSinPapeles,
      ] as any);
      movimientosService.findByCaja.mockResolvedValue([]);

      const result = await service.getDashboard('persona-1');

      const autorizaciones = result.inscripciones.items[0].autorizaciones;
      expect(autorizaciones?.autorizacionDeImagen).toBe(true);
      expect(autorizaciones?.autorizacionIngreso).toBe(true);
      expect(autorizaciones?.salidasCercanas).toBe(true);
      expect(autorizaciones?.completas).toBe(true);
    });
  });
});
