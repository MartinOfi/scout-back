import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CampamentosService } from './campamentos.service';
import { Campamento } from './entities/campamento.entity';
import { CampamentoParticipante } from './entities/campamento-participante.entity';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { PagosService } from '../pagos/pagos.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import {
  MedioPago,
  EstadoPago,
  CajaType,
  TipoMovimiento,
  ConceptoMovimiento,
  EstadoPagoCampamento,
  FiltroMovimientosCampamento,
} from '../../common/enums';
import { Persona } from '../personas/entities/persona.entity';
import { Caja } from '../cajas/entities/caja.entity';

describe('CampamentosService', () => {
  let service: CampamentosService;
  let campamentoRepository: jest.Mocked<Repository<Campamento>>;
  let campamentoParticipanteRepository: jest.Mocked<
    Repository<CampamentoParticipante>
  >;
  let personasService: jest.Mocked<PersonasService>;
  let cajasService: jest.Mocked<CajasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let pagosService: jest.Mocked<PagosService>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;

  const mockPersona: Partial<Persona> = {
    id: 'persona-uuid',
    nombre: 'Juan Scout',
  };

  const mockCampamentoParticipante: Partial<CampamentoParticipante> = {
    id: 'cp-uuid',
    campamentoId: 'campamento-uuid',
    personaId: 'persona-uuid',
    autorizacionEntregada: false,
    persona: mockPersona as Persona,
    deletedAt: null,
  };

  const mockCampamento: Partial<Campamento> = {
    id: 'campamento-uuid',
    nombre: 'Campamento Verano 2024',
    fechaInicio: new Date('2024-01-15'),
    fechaFin: new Date('2024-01-20'),
    costoPorPersona: 15000,
    participantes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCajaGrupo: Partial<Caja> = {
    id: 'caja-grupo-uuid',
    tipo: CajaType.GRUPO,
  };

  beforeEach(async () => {
    const mockCampamentoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockCampamentoParticipanteRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    const mockPersonasService = {
      findOne: jest.fn().mockResolvedValue(mockPersona),
    };

    const mockCajasService = {
      findCajaGrupo: jest.fn().mockResolvedValue(mockCajaGrupo),
    };

    const mockMovimientosService = {
      create: jest.fn(),
      findByRelatedEntity: jest.fn().mockResolvedValue([]),
    };

    const mockDeletionValidator = {
      canDeleteCampamento: jest.fn().mockResolvedValue({ canDelete: true }),
    };

    const mockPagosService = {
      ejecutarPagoConManager: jest.fn().mockResolvedValue({
        movimientoIngreso: {
          id: 'mov-ingreso-uuid',
          monto: 10000,
          concepto: 'CAMPAMENTO_PAGO',
        },
        desglose: {
          montoTotal: 10000,
          montoPagadoFisico: 10000,
          montoDescontadoSaldoPersonal: 0,
        },
      }),
    };

    const mockManager = {
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampamentosService,
        {
          provide: getRepositoryToken(Campamento),
          useValue: mockCampamentoRepository,
        },
        {
          provide: getRepositoryToken(CampamentoParticipante),
          useValue: mockCampamentoParticipanteRepository,
        },
        {
          provide: PersonasService,
          useValue: mockPersonasService,
        },
        {
          provide: CajasService,
          useValue: mockCajasService,
        },
        {
          provide: MovimientosService,
          useValue: mockMovimientosService,
        },
        {
          provide: PagosService,
          useValue: mockPagosService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: DeletionValidatorService,
          useValue: mockDeletionValidator,
        },
      ],
    }).compile();

    service = module.get<CampamentosService>(CampamentosService);
    campamentoRepository = module.get(getRepositoryToken(Campamento));
    campamentoParticipanteRepository = module.get(
      getRepositoryToken(CampamentoParticipante),
    );
    personasService = module.get(PersonasService);
    cajasService = module.get(CajasService);
    movimientosService = module.get(MovimientosService);
    pagosService = module.get(PagosService);
    deletionValidator = module.get(DeletionValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a campamento when found', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );

      const result = await service.findOne('campamento-uuid');

      expect(result).toEqual(mockCampamento);
      expect(campamentoRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'campamento-uuid' },
        relations: ['participantes', 'participantes.persona'],
      });
    });

    it('should throw NotFoundException when campamento not found', async () => {
      campamentoRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft remove campamento when no movements exist', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );
      deletionValidator.canDeleteCampamento.mockResolvedValue({
        canDelete: true,
      });
      campamentoRepository.softRemove.mockResolvedValue(
        mockCampamento as Campamento,
      );

      await service.remove('campamento-uuid');

      expect(deletionValidator.canDeleteCampamento).toHaveBeenCalledWith(
        'campamento-uuid',
      );
      expect(campamentoRepository.softRemove).toHaveBeenCalledWith(
        mockCampamento,
      );
    });

    it('should throw NotFoundException when campamento does not exist', async () => {
      campamentoRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(deletionValidator.canDeleteCampamento).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when campamento has movements', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );
      deletionValidator.canDeleteCampamento.mockResolvedValue({
        canDelete: false,
        reason: 'No se puede eliminar: el campamento tiene 10 movimiento(s)',
        movementCount: 10,
      });

      await expect(service.remove('campamento-uuid')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.remove('campamento-uuid')).rejects.toThrow(
        /campamento tiene 10 movimiento/,
      );
      expect(campamentoRepository.softRemove).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a campamento', async () => {
      const dto = {
        nombre: 'Nuevo Campamento',
        fechaInicio: new Date('2024-06-01'),
        fechaFin: new Date('2024-06-05'),
        costoPorPersona: 20000,
      };

      const created = { ...dto, id: 'new-uuid', participantes: [] };

      campamentoRepository.create.mockReturnValue(created as Campamento);
      campamentoRepository.save.mockResolvedValue(created as Campamento);

      const result = await service.create(dto);

      expect(campamentoRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toBeDefined();
    });
  });

  describe('addParticipante', () => {
    it('should add a participant to campamento', async () => {
      const campamentoSinParticipantes = {
        ...mockCampamento,
        participantes: [],
      };
      const campamentoConParticipante = {
        ...mockCampamento,
        participantes: [mockCampamentoParticipante as CampamentoParticipante],
      };

      campamentoRepository.findOne
        .mockResolvedValueOnce(campamentoSinParticipantes as Campamento)
        .mockResolvedValueOnce(campamentoConParticipante as Campamento);

      campamentoParticipanteRepository.findOne.mockResolvedValue(null);
      campamentoParticipanteRepository.create.mockReturnValue(
        mockCampamentoParticipante as CampamentoParticipante,
      );
      campamentoParticipanteRepository.save.mockResolvedValue(
        mockCampamentoParticipante as CampamentoParticipante,
      );

      const result = await service.addParticipante('campamento-uuid', {
        personaId: 'persona-uuid',
      });

      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
      expect(campamentoParticipanteRepository.save).toHaveBeenCalled();
      expect(result.participantes).toHaveLength(1);
    });

    it('should throw BadRequestException when participant already added', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );
      campamentoParticipanteRepository.findOne.mockResolvedValue(
        mockCampamentoParticipante as CampamentoParticipante,
      );

      await expect(
        service.addParticipante('campamento-uuid', {
          personaId: 'persona-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.addParticipante('campamento-uuid', {
          personaId: 'persona-uuid',
        }),
      ).rejects.toThrow(/ya está inscrita/);
    });
  });

  describe('removeParticipante', () => {
    it('should soft-delete the junction record and return updated campamento', async () => {
      campamentoParticipanteRepository.findOne.mockResolvedValue(
        mockCampamentoParticipante as CampamentoParticipante,
      );
      campamentoParticipanteRepository.softDelete.mockResolvedValue({
        affected: 1,
      } as any);
      campamentoRepository.findOne.mockResolvedValue({
        ...mockCampamento,
        participantes: [],
      } as Campamento);

      const result = await service.removeParticipante(
        'campamento-uuid',
        'persona-uuid',
      );

      expect(campamentoParticipanteRepository.softDelete).toHaveBeenCalledWith(
        'cp-uuid',
      );
      expect(result.participantes).toHaveLength(0);
    });

    it('should throw NotFoundException when participant is not inscribed', async () => {
      campamentoParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(
        service.removeParticipante('campamento-uuid', 'persona-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateParticipanteAutorizacion', () => {
    it('should update autorizacionEntregada when participant is found', async () => {
      campamentoParticipanteRepository.findOne.mockResolvedValue(
        mockCampamentoParticipante as CampamentoParticipante,
      );
      campamentoParticipanteRepository.save.mockResolvedValue({
        ...mockCampamentoParticipante,
        autorizacionEntregada: true,
      } as CampamentoParticipante);

      await service.updateParticipanteAutorizacion(
        'campamento-uuid',
        'persona-uuid',
        { autorizacionEntregada: true },
      );

      expect(campamentoParticipanteRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ autorizacionEntregada: true }),
      );
    });

    it('should throw NotFoundException when participant is not inscribed', async () => {
      campamentoParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateParticipanteAutorizacion(
          'campamento-uuid',
          'persona-uuid',
          { autorizacionEntregada: true },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('registrarPago', () => {
    it('should register payment using PagosService', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );

      const result = await service.registrarPago(
        'campamento-uuid',
        'persona-uuid',
        {
          montoPagado: 10000,
          medioPago: MedioPago.EFECTIVO,
        },
      );

      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
      expect(pagosService.ejecutarPagoConManager).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          personaId: 'persona-uuid',
          montoTotal: 10000,
          montoConSaldoPersonal: 0,
          campamentoId: 'campamento-uuid',
        }),
      );
      expect(result.movimientoIngreso).toBeDefined();
    });

    it('should support mixed payment with personal account balance', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );

      await service.registrarPago('campamento-uuid', 'persona-uuid', {
        montoPagado: 5000,
        montoConSaldoPersonal: 3000,
        medioPago: MedioPago.EFECTIVO,
      });

      expect(pagosService.ejecutarPagoConManager).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          montoTotal: 8000,
          montoConSaldoPersonal: 3000,
        }),
      );
    });

    it('should throw BadRequestException when total is zero', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );

      await expect(
        service.registrarPago('campamento-uuid', 'persona-uuid', {
          montoPagado: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when montoPagado > 0 without medioPago', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );

      await expect(
        service.registrarPago('campamento-uuid', 'persona-uuid', {
          montoPagado: 5000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('registrarGasto', () => {
    it('should register expense and create movement', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );

      await service.registrarGasto(
        'campamento-uuid',
        5000,
        'Comida',
        'responsable-uuid',
        MedioPago.TRANSFERENCIA,
        EstadoPago.PAGADO,
      );

      expect(movimientosService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          monto: 5000,
          campamentoId: 'campamento-uuid',
        }),
        undefined,
      );
    });

    it('should pass registradoPorId to movimientosService.create', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );

      await service.registrarGasto(
        'campamento-uuid',
        5000,
        'Comida',
        'responsable-uuid',
        MedioPago.TRANSFERENCIA,
        EstadoPago.PAGADO,
        'educador-uuid',
      );

      expect(movimientosService.create).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 5000 }),
        'educador-uuid',
      );
    });
  });

  describe('getResumenFinanciero', () => {
    it('should return financial summary', async () => {
      const campamentoConParticipantes = {
        ...mockCampamento,
        participantes: [
          mockCampamentoParticipante as CampamentoParticipante,
          {
            id: 'cp-uuid-2',
            personaId: 'persona2',
            persona: { nombre: 'Maria' },
          } as CampamentoParticipante,
        ],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConParticipantes as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.getResumenFinanciero('campamento-uuid');

      expect(result.participantes).toBe(2);
      expect(result.totalEsperado).toBe(30000); // 2 * 15000
      expect(result.totalRecaudado).toBe(0);
      expect(result.totalGastado).toBe(0);
      expect(result.totalPendienteReembolso).toBe(0);
      expect(result.saldo).toBe(0);
    });
  });

  describe('findAll', () => {
    it('should return all campamentos ordered by fechaInicio DESC', async () => {
      campamentoRepository.find.mockResolvedValue([
        mockCampamento as Campamento,
      ]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(campamentoRepository.find).toHaveBeenCalledWith({
        relations: ['participantes', 'participantes.persona'],
        order: { fechaInicio: 'DESC' },
      });
    });
  });

  describe('getDetalle', () => {
    const mockMovimientoPago = {
      id: 'mov-pago-uuid',
      tipo: TipoMovimiento.INGRESO,
      concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
      monto: 10000,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PAGADO,
      responsableId: 'persona-uuid',
      responsable: { nombre: 'Juan Scout' },
      fecha: new Date('2026-01-10'),
      descripcion: 'Pago campamento',
    };

    const mockMovimientoUseSaldo = {
      id: 'mov-saldo-uuid',
      tipo: TipoMovimiento.EGRESO,
      concepto: ConceptoMovimiento.USO_SALDO_PERSONAL,
      monto: 5000,
      medioPago: MedioPago.SALDO_PERSONAL,
      estadoPago: EstadoPago.PAGADO,
      responsableId: 'persona-uuid',
      responsable: { nombre: 'Juan Scout' },
      fecha: new Date('2026-01-10'),
      descripcion: 'Uso saldo personal',
    };

    const mockMovimientoGasto = {
      id: 'mov-gasto-uuid',
      tipo: TipoMovimiento.EGRESO,
      concepto: ConceptoMovimiento.CAMPAMENTO_GASTO,
      monto: 3000,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PAGADO,
      responsableId: 'persona-uuid',
      responsable: { nombre: 'Juan Scout' },
      fecha: new Date('2026-01-15'),
      descripcion: 'Compra galletitas',
    };

    const campamentoConParticipante = {
      ...mockCampamento,
      costoPorPersona: 15000,
      cuotasBase: 3,
      descripcion: null,
      participantes: [mockCampamentoParticipante as CampamentoParticipante],
    };

    beforeEach(() => {
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConParticipante as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockMovimientoPago,
        mockMovimientoUseSaldo,
        mockMovimientoGasto,
      ] as any);
    });

    it('should return all movements when no filter specified', async () => {
      const result = await service.getDetalle('campamento-uuid');

      expect(result.movimientos).toHaveLength(3);
    });

    it('should return all movements when filtro is TODOS', async () => {
      const result = await service.getDetalle(
        'campamento-uuid',
        FiltroMovimientosCampamento.TODOS,
      );

      expect(result.movimientos).toHaveLength(3);
    });

    it('should return only INGRESO movements when filtro is INGRESOS', async () => {
      const result = await service.getDetalle(
        'campamento-uuid',
        FiltroMovimientosCampamento.INGRESOS,
      );

      expect(result.movimientos).toHaveLength(1);
      expect(result.movimientos[0].id).toBe('mov-pago-uuid');
      expect(result.movimientos[0].tipo).toBe(TipoMovimiento.INGRESO);
    });

    it('should return only CAMPAMENTO_GASTO movements when filtro is GASTOS', async () => {
      const result = await service.getDetalle(
        'campamento-uuid',
        FiltroMovimientosCampamento.GASTOS,
      );

      expect(result.movimientos).toHaveLength(1);
      expect(result.movimientos[0].id).toBe('mov-gasto-uuid');
      expect(result.movimientos[0].concepto).toBe(
        ConceptoMovimiento.CAMPAMENTO_GASTO,
      );
    });

    it('should exclude USO_SALDO_PERSONAL from GASTOS filter', async () => {
      const result = await service.getDetalle(
        'campamento-uuid',
        FiltroMovimientosCampamento.GASTOS,
      );

      const conceptos = result.movimientos.map((m) => m.concepto);
      expect(conceptos).not.toContain(ConceptoMovimiento.USO_SALDO_PERSONAL);
    });

    it('should return all EGRESO movements when filtro is EGRESOS', async () => {
      const result = await service.getDetalle(
        'campamento-uuid',
        FiltroMovimientosCampamento.EGRESOS,
      );

      // 2 egresos: CAMPAMENTO_GASTO + USO_SALDO_PERSONAL
      expect(result.movimientos).toHaveLength(2);
      result.movimientos.forEach((m) =>
        expect(m.tipo).toBe(TipoMovimiento.EGRESO),
      );
    });

    it('should include USO_SALDO_PERSONAL in EGRESOS filter', async () => {
      const result = await service.getDetalle(
        'campamento-uuid',
        FiltroMovimientosCampamento.EGRESOS,
      );

      const conceptos = result.movimientos.map((m) => m.concepto);
      expect(conceptos).toContain(ConceptoMovimiento.USO_SALDO_PERSONAL);
      expect(conceptos).toContain(ConceptoMovimiento.CAMPAMENTO_GASTO);
    });

    it('should always calculate KPIs with all movements regardless of filter', async () => {
      const resultTodos = await service.getDetalle('campamento-uuid');
      const resultGastos = await service.getDetalle(
        'campamento-uuid',
        FiltroMovimientosCampamento.GASTOS,
      );

      // KPIs must be identical regardless of filter
      expect(resultGastos.kpis.totalGastado).toBe(
        resultTodos.kpis.totalGastado,
      );
      expect(resultGastos.kpis.totalRecaudado).toBe(
        resultTodos.kpis.totalRecaudado,
      );
    });

    it('should calculate totalGastado with only CAMPAMENTO_GASTO PAGADO (not USO_SALDO_PERSONAL)', async () => {
      const result = await service.getDetalle('campamento-uuid');

      // totalGastado = only mockMovimientoGasto (3000, PAGADO), NOT mockMovimientoUseSaldo (5000)
      expect(result.kpis.totalGastado).toBe(3000);
      expect(result.kpis.totalPendienteReembolso).toBe(0);
    });

    it('should discriminate CAMPAMENTO_GASTO by estadoPago into totalGastado vs totalPendienteReembolso', async () => {
      const mockMovimientoGastoPendiente = {
        id: 'mov-gasto-pendiente-uuid',
        tipo: TipoMovimiento.EGRESO,
        concepto: ConceptoMovimiento.CAMPAMENTO_GASTO,
        monto: 2000,
        medioPago: MedioPago.EFECTIVO,
        estadoPago: EstadoPago.PENDIENTE_REEMBOLSO,
        responsableId: 'persona-uuid',
        responsable: { nombre: 'Juan Scout' },
        fecha: new Date('2026-01-16'),
        descripcion: 'Gasto adelantado por persona',
      };

      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockMovimientoPago,
        mockMovimientoUseSaldo,
        mockMovimientoGasto, // 3000, PAGADO
        mockMovimientoGastoPendiente, // 2000, PENDIENTE_REEMBOLSO
      ] as any);

      const result = await service.getDetalle('campamento-uuid');

      expect(result.kpis.totalGastado).toBe(3000);
      expect(result.kpis.totalPendienteReembolso).toBe(2000);
      // balance only deducts effective expenses
      expect(result.kpis.balance).toBe(10000 - 3000);
    });

    it('should calculate totalRecaudado from INGRESO movements', async () => {
      const result = await service.getDetalle('campamento-uuid');

      expect(result.kpis.totalRecaudado).toBe(10000);
    });

    it('should include concepto in movement DTOs', async () => {
      const result = await service.getDetalle('campamento-uuid');

      const pagoDto = result.movimientos.find((m) => m.id === 'mov-pago-uuid');
      expect(pagoDto?.concepto).toBe(ConceptoMovimiento.CAMPAMENTO_PAGO);
    });

    it('should compute participant payment status correctly', async () => {
      const result = await service.getDetalle('campamento-uuid');

      expect(result.participantes).toHaveLength(1);
      const participante = result.participantes[0];
      expect(participante.totalPagado).toBe(10000);
      expect(participante.saldoPendiente).toBe(5000); // 15000 - 10000
      expect(participante.estadoPago).toBe(EstadoPagoCampamento.PARCIAL);
    });

    it('should include autorizacionEntregada in participant DTOs', async () => {
      const result = await service.getDetalle('campamento-uuid');

      expect(result.participantes[0].autorizacionEntregada).toBe(false);
    });
  });

  describe('eliminarPagoCampamento', () => {
    const mockMovimientoIngreso = {
      id: 'mov-ingreso-uuid',
      tipo: TipoMovimiento.INGRESO,
      concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
      monto: 10000,
      medioPago: MedioPago.EFECTIVO,
      responsableId: 'persona-uuid',
      movimientoRelacionadoId: null,
    };

    const mockMovimientoIngresoConRelacion = {
      id: 'mov-ingreso-saldo-uuid',
      tipo: TipoMovimiento.INGRESO,
      concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
      monto: 10000,
      medioPago: MedioPago.SALDO_PERSONAL,
      responsableId: 'persona-uuid',
      movimientoRelacionadoId: 'mov-egreso-uuid', // Linked to egreso
    };

    const mockMovimientoEgreso = {
      id: 'mov-egreso-uuid',
      tipo: TipoMovimiento.EGRESO,
      concepto: ConceptoMovimiento.USO_SALDO_PERSONAL,
      monto: 10000,
      medioPago: MedioPago.SALDO_PERSONAL,
      responsableId: 'persona-uuid',
      movimientoRelacionadoId: 'mov-ingreso-saldo-uuid',
    };

    it('should delete payment when paid with cash only (no related movement)', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockMovimientoIngreso,
      ]);

      const result = await service.eliminarPagoCampamento(
        'campamento-uuid',
        'mov-ingreso-uuid',
      );

      expect(result.movimientosEliminados).toEqual(['mov-ingreso-uuid']);
      expect(result.montoRevertido).toBe(10000);
    });

    it('should delete both ingreso and related egreso when linked', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockMovimientoIngresoConRelacion,
        mockMovimientoEgreso,
      ]);

      const result = await service.eliminarPagoCampamento(
        'campamento-uuid',
        'mov-ingreso-saldo-uuid',
      );

      expect(result.movimientosEliminados).toContain('mov-ingreso-saldo-uuid');
      expect(result.movimientosEliminados).toContain('mov-egreso-uuid');
      expect(result.movimientosEliminados).toHaveLength(2);
    });

    it('should throw NotFoundException when movimiento not found', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      await expect(
        service.eliminarPagoCampamento('campamento-uuid', 'non-existent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when movimiento is not a payment', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );
      // Return a GASTO instead of PAGO
      movimientosService.findByRelatedEntity.mockResolvedValue([
        {
          id: 'mov-gasto-uuid',
          tipo: TipoMovimiento.EGRESO,
          concepto: ConceptoMovimiento.CAMPAMENTO_GASTO,
          monto: 5000,
        },
      ]);

      await expect(
        service.eliminarPagoCampamento('campamento-uuid', 'mov-gasto-uuid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTotalDeudaCampamentos', () => {
    const buildQueryBuilderMock = (
      rawResult: { total: string | null; cantidad: string } | null,
    ) => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(rawResult),
      };
      campamentoRepository.createQueryBuilder.mockReturnValue(qb as any);
      return qb;
    };

    it('should return total and cantidad from a single aggregation query', async () => {
      buildQueryBuilderMock({ total: '2000.00', cantidad: '3' });

      const result = await service.getTotalDeudaCampamentos();

      expect(result).toEqual({ total: 2000, cantidad: 3 });
      expect(campamentoRepository.createQueryBuilder).toHaveBeenCalledWith('c');
    });

    it('should return { total: 0, cantidad: 0 } when result is null', async () => {
      buildQueryBuilderMock(null);

      const result = await service.getTotalDeudaCampamentos();

      expect(result).toEqual({ total: 0, cantidad: 0 });
    });

    it('should return { total: 0, cantidad: 0 } when total is null', async () => {
      buildQueryBuilderMock({ total: null, cantidad: '0' });

      const result = await service.getTotalDeudaCampamentos();

      expect(result).toEqual({ total: 0, cantidad: 0 });
    });

    it('should NOT call getPagosPorParticipante or findByRelatedEntity (no N+1)', async () => {
      buildQueryBuilderMock({ total: '5000', cantidad: '1' });

      await service.getTotalDeudaCampamentos();

      expect(movimientosService.findByRelatedEntity).not.toHaveBeenCalled();
      expect(campamentoRepository.find).not.toHaveBeenCalled();
    });
  });
});
