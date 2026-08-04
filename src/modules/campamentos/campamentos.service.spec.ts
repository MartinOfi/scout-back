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
import { BonificacionesService } from '../bonificaciones/bonificaciones.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import {
  MedioPago,
  EstadoPago,
  CajaType,
  TipoMovimiento,
  ConceptoMovimiento,
  EstadoPagoCampamento,
  FiltroMovimientosCampamento,
  PersonaType,
} from '../../common/enums';
import { Persona } from '../personas/entities/persona.entity';
import { Caja } from '../cajas/entities/caja.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import {
  ParticipantePagoDto,
  CampamentoKpisDto,
} from './dtos/campamento-detalle.dto';

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
  let bonificacionesService: jest.Mocked<BonificacionesService>;
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
    montoAsignado: 15000,
    montoBonificado: 0,
    deletedAt: null,
  };

  const mockCampamento: Partial<Campamento> = {
    id: 'campamento-uuid',
    nombre: 'Campamento Verano 2024',
    fechaInicio: new Date('2024-01-15'),
    fechaFin: new Date('2024-01-20'),
    costoPorPersona: 15000,
    costoEducadores: 0,
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

    const mockBonificacionesService = {
      otorgarConManager: jest.fn().mockResolvedValue({
        movimientoEgresoId: 'egreso-bonif-uuid',
        movimientoIngresoId: 'ingreso-bonif-uuid',
        monto: 0,
        saldoFondoRestante: 0,
      }),
      revertirConManager: jest.fn().mockResolvedValue(undefined),
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
      update: jest.fn().mockResolvedValue(undefined),
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
          provide: BonificacionesService,
          useValue: mockBonificacionesService,
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
    bonificacionesService = module.get(BonificacionesService);
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

    it('crea un campamento con costoEducadores en 0 por defecto', async () => {
      campamentoRepository.create.mockImplementation(
        (dto) => ({ ...dto, costoEducadores: 0 }) as Campamento,
      );
      campamentoRepository.save.mockImplementation((c) =>
        Promise.resolve(c as Campamento),
      );

      const result = await service.create({
        nombre: 'Campamento de verano',
        fechaInicio: new Date('2026-01-10'),
        fechaFin: new Date('2026-01-15'),
        costoPorPersona: 50000,
        cuotasBase: 3,
      });

      expect(result.costoEducadores).toBe(0);
    });
  });

  describe('update', () => {
    it('permite actualizar costoEducadores', async () => {
      campamentoRepository.findOne.mockResolvedValue({
        ...mockCampamento,
        costoEducadores: 0,
      } as Campamento);
      campamentoRepository.save.mockImplementation((c) =>
        Promise.resolve(c as Campamento),
      );

      const result = await service.update('campamento-uuid', {
        costoEducadores: 10000,
      });

      expect(result.costoEducadores).toBe(10000);
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

  describe('addParticipante — monto asignado', () => {
    const campamentoConCostos = {
      id: 'campamento-id',
      costoPorPersona: 50000,
      costoEducadores: 10000,
      participantes: [],
    } as unknown as Campamento;

    beforeEach(() => {
      jest.spyOn(service, 'findOne').mockResolvedValue(campamentoConCostos);
      campamentoParticipanteRepository.findOne.mockResolvedValue(null);
      campamentoParticipanteRepository.create.mockImplementation(
        (cp) => cp as CampamentoParticipante,
      );
      campamentoParticipanteRepository.save.mockImplementation((cp) =>
        Promise.resolve(cp as CampamentoParticipante),
      );
    });

    it('asigna costoPorPersona a un protagonista', async () => {
      personasService.findOne.mockResolvedValue({
        id: 'persona-id',
        tipo: PersonaType.PROTAGONISTA,
      } as never);

      await service.addParticipante('campamento-id', {
        personaId: 'persona-id',
      });

      const created = (campamentoParticipanteRepository.create as jest.Mock)
        .mock.calls[0][0];
      expect(created.montoAsignado).toBe(50000);
      expect(created.montoBonificado).toBe(0);
    });

    it('asigna costoEducadores a un educador', async () => {
      personasService.findOne.mockResolvedValue({
        id: 'educador-id',
        tipo: PersonaType.EDUCADOR,
      } as never);

      await service.addParticipante('campamento-id', {
        personaId: 'educador-id',
      });

      const created = (campamentoParticipanteRepository.create as jest.Mock)
        .mock.calls[0][0];
      expect(created.montoAsignado).toBe(10000);
    });
  });

  describe('determineEstadoPago', () => {
    const determinar = (
      pagado: number,
      asignado: number,
      bonificado = 0,
    ): EstadoPagoCampamento =>
      (
        service as unknown as {
          determineEstadoPago: (
            p: number,
            a: number,
            b: number,
          ) => EstadoPagoCampamento;
        }
      ).determineEstadoPago(pagado, asignado, bonificado);

    it('EXENTO cuando el monto asignado es 0', () => {
      expect(determinar(0, 0)).toBe(EstadoPagoCampamento.EXENTO);
    });
    it('PAGADO cuando la bonificación cubre todo', () => {
      expect(determinar(0, 10000, 10000)).toBe(EstadoPagoCampamento.PAGADO);
    });
    it('PAGADO cuando pago y bonificación suman el total', () => {
      expect(determinar(5000, 10000, 5000)).toBe(EstadoPagoCampamento.PAGADO);
    });
    it('PARCIAL cuando sólo hay bonificación parcial', () => {
      expect(determinar(0, 10000, 5000)).toBe(EstadoPagoCampamento.PARCIAL);
    });
    it('PENDIENTE sin pagos ni bonificación', () => {
      expect(determinar(0, 50000)).toBe(EstadoPagoCampamento.PENDIENTE);
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

  describe('bonificarParticipante', () => {
    const participanteBonificable: Partial<CampamentoParticipante> = {
      id: 'cp-uuid',
      campamentoId: 'campamento-uuid',
      personaId: 'educador-uuid',
      montoAsignado: 10000,
      montoBonificado: 0,
    };

    beforeEach(() => {
      campamentoParticipanteRepository.findOne.mockResolvedValue(
        participanteBonificable as CampamentoParticipante,
      );
      campamentoRepository.findOne.mockResolvedValue({
        ...mockCampamento,
        participantes: [],
      } as Campamento);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);
    });

    it('otorga la bonificación y guarda el monto', async () => {
      await service.bonificarParticipante(
        'campamento-uuid',
        'educador-uuid',
        5000,
      );

      expect(bonificacionesService.otorgarConManager).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          personaId: 'educador-uuid',
          monto: 5000,
          campamentoId: 'campamento-uuid',
        }),
      );
    });

    it('rechaza bonificar más que el monto asignado', async () => {
      await expect(
        service.bonificarParticipante(
          'campamento-uuid',
          'educador-uuid',
          15000,
        ),
      ).rejects.toThrow(
        'El monto bonificado no puede exceder el saldo pendiente ($10000)',
      );

      expect(bonificacionesService.otorgarConManager).not.toHaveBeenCalled();
    });

    it('rechaza bonificar más que el saldo pendiente cuando ya hay un pago parcial', async () => {
      // $10.000 asignados, $2.000 ya pagados en efectivo: sólo quedan $8.000
      // bonificables. Bonificar $10.000 dejaría un "pagado" de $12.000/$10.000.
      movimientosService.findByRelatedEntity.mockResolvedValue([
        {
          id: 'pago-uuid',
          tipo: TipoMovimiento.INGRESO,
          concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
          responsableId: 'educador-uuid',
          monto: 2000,
        },
      ] as any);

      await expect(
        service.bonificarParticipante(
          'campamento-uuid',
          'educador-uuid',
          10000,
        ),
      ).rejects.toThrow(
        'El monto bonificado no puede exceder el saldo pendiente ($8000)',
      );

      expect(bonificacionesService.otorgarConManager).not.toHaveBeenCalled();
    });

    it('permite bonificar exactamente el saldo pendiente cuando ya hay un pago parcial', async () => {
      movimientosService.findByRelatedEntity.mockResolvedValue([
        {
          id: 'pago-uuid',
          tipo: TipoMovimiento.INGRESO,
          concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
          responsableId: 'educador-uuid',
          monto: 2000,
        },
      ] as any);

      await service.bonificarParticipante(
        'campamento-uuid',
        'educador-uuid',
        8000,
      );

      expect(bonificacionesService.otorgarConManager).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ monto: 8000 }),
      );
    });

    it('rechaza bonificar a un participante exento', async () => {
      campamentoParticipanteRepository.findOne.mockResolvedValue({
        ...participanteBonificable,
        montoAsignado: 0,
      } as CampamentoParticipante);

      await expect(
        service.bonificarParticipante('campamento-uuid', 'educador-uuid', 1000),
      ).rejects.toThrow('No se puede bonificar a un participante exento');

      expect(bonificacionesService.otorgarConManager).not.toHaveBeenCalled();
    });

    it('rechaza si el participante no está en el campamento', async () => {
      campamentoParticipanteRepository.findOne.mockResolvedValue(null);

      await expect(
        service.bonificarParticipante('campamento-uuid', 'otro-id', 1000),
      ).rejects.toThrow('El participante no está inscrito en el campamento');
    });

    it('al ajustar revierte la bonificación previa antes de otorgar la nueva', async () => {
      movimientosService.findByRelatedEntity.mockResolvedValue([
        {
          id: 'egreso-previo-uuid',
          tipo: TipoMovimiento.EGRESO,
          concepto: ConceptoMovimiento.BONIFICACION_OTORGADA,
          responsableId: 'educador-uuid',
        },
      ] as any);

      await service.bonificarParticipante(
        'campamento-uuid',
        'educador-uuid',
        8000,
      );

      expect(bonificacionesService.revertirConManager).toHaveBeenCalledWith(
        expect.anything(),
        'egreso-previo-uuid',
      );
      expect(bonificacionesService.otorgarConManager).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ monto: 8000 }),
      );
    });

    it('quitarBonificacionParticipante revierte sin otorgar una nueva', async () => {
      movimientosService.findByRelatedEntity.mockResolvedValue([
        {
          id: 'egreso-previo-uuid',
          tipo: TipoMovimiento.EGRESO,
          concepto: ConceptoMovimiento.BONIFICACION_OTORGADA,
          responsableId: 'educador-uuid',
        },
      ] as any);

      await service.quitarBonificacionParticipante(
        'campamento-uuid',
        'educador-uuid',
      );

      expect(bonificacionesService.revertirConManager).toHaveBeenCalledWith(
        expect.anything(),
        'egreso-previo-uuid',
      );
      expect(bonificacionesService.otorgarConManager).not.toHaveBeenCalled();
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
            montoAsignado: 15000,
            montoBonificado: 0,
          } as CampamentoParticipante,
        ],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConParticipantes as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.getResumenFinanciero('campamento-uuid');

      expect(result.participantes).toBe(2);
      expect(result.totalEsperado).toBe(30000); // 15000 + 15000
      expect(result.totalRecaudado).toBe(0);
      expect(result.totalGastado).toBe(0);
      expect(result.totalPendienteReembolso).toBe(0);
      expect(result.saldo).toBe(0);
    });

    it('totalEsperado suma montoAsignado por participante, no un costo uniforme', async () => {
      const campamentoConEducador = {
        ...mockCampamento,
        participantes: [
          mockCampamentoParticipante as CampamentoParticipante, // montoAsignado: 15000
          {
            id: 'cp-uuid-educador',
            personaId: 'educador-uuid',
            persona: { nombre: 'Rosa Educadora' },
            montoAsignado: 0, // educador exento
            montoBonificado: 0,
          } as CampamentoParticipante,
        ],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConEducador as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.getResumenFinanciero('campamento-uuid');

      // Si usara costoPorPersona uniforme (15000) * 2 participantes daría 30000
      expect(result.totalEsperado).toBe(15000);
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

  describe('calculateKpis', () => {
    it('calcula KPIs con exentos y bonificados', () => {
      const participantes: ParticipantePagoDto[] = [
        {
          montoAsignado: 50000,
          montoBonificado: 0,
          totalPagado: 50000,
          saldoPendiente: 0,
          estadoPago: EstadoPagoCampamento.PAGADO,
        } as ParticipantePagoDto,
        {
          montoAsignado: 50000,
          montoBonificado: 0,
          totalPagado: 0,
          saldoPendiente: 50000,
          estadoPago: EstadoPagoCampamento.PENDIENTE,
        } as ParticipantePagoDto,
        {
          montoAsignado: 0,
          montoBonificado: 0,
          totalPagado: 0,
          saldoPendiente: 0,
          estadoPago: EstadoPagoCampamento.EXENTO,
        } as ParticipantePagoDto,
        {
          montoAsignado: 10000,
          montoBonificado: 5000,
          totalPagado: 5000,
          saldoPendiente: 0,
          estadoPago: EstadoPagoCampamento.PAGADO,
        } as ParticipantePagoDto,
      ];

      const kpis = (
        service as unknown as {
          calculateKpis: (
            p: ParticipantePagoDto[],
            m: Movimiento[],
          ) => CampamentoKpisDto;
        }
      ).calculateKpis(participantes, []);

      expect(kpis.totalARecaudar).toBe(110000);
      expect(kpis.totalBonificado).toBe(5000);
      expect(kpis.participantesExentos).toBe(1);
      expect(kpis.participantesPagadosCompleto).toBe(2);
      expect(kpis.participantesPendientes).toBe(1);
      expect(kpis.deudaTotal).toBe(50000);
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

    it('incluye costoEducadores en el DTO de campamento', async () => {
      campamentoRepository.findOne.mockResolvedValue({
        ...campamentoConParticipante,
        costoEducadores: 10000,
      } as Campamento);

      const result = await service.getDetalle('campamento-uuid');

      expect(result.campamento.costoEducadores).toBe(10000);
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

    it('expone montoAsignado y montoBonificado en vez de costoPorPersona uniforme', async () => {
      const result = await service.getDetalle('campamento-uuid');

      const participante = result.participantes[0];
      expect(participante.montoAsignado).toBe(15000);
      expect(participante.montoBonificado).toBe(0);
      expect(
        (participante as unknown as { costoPorPersona?: number })
          .costoPorPersona,
      ).toBeUndefined();
    });

    it('descuenta montoBonificado del saldoPendiente y del estadoPago', async () => {
      const campamentoConBonificado = {
        ...campamentoConParticipante,
        participantes: [
          {
            ...mockCampamentoParticipante,
            montoAsignado: 15000,
            montoBonificado: 3000,
          } as CampamentoParticipante,
        ],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConBonificado as Campamento,
      );

      const result = await service.getDetalle('campamento-uuid');

      const participante = result.participantes[0];
      // totalPagado 10000 + montoBonificado 3000 = 13000 cubierto de 15000
      expect(participante.saldoPendiente).toBe(2000);
      expect(participante.estadoPago).toBe(EstadoPagoCampamento.PARCIAL);
    });

    it('incluye los movimientos de bonificación en participante.pagos, con concepto, sin sumarlos a totalPagado', async () => {
      const mockMovimientoBonificacionOtorgada = {
        id: 'mov-bon-otorgada-uuid',
        tipo: TipoMovimiento.EGRESO,
        concepto: ConceptoMovimiento.BONIFICACION_OTORGADA,
        monto: 3000,
        medioPago: MedioPago.EFECTIVO,
        estadoPago: EstadoPago.PAGADO,
        responsableId: 'persona-uuid',
        responsable: { nombre: 'Juan Scout' },
        fecha: new Date('2026-01-11'),
        descripcion: 'Bonificación campamento',
      };
      const mockMovimientoBonificacionRecibida = {
        id: 'mov-bon-recibida-uuid',
        tipo: TipoMovimiento.INGRESO,
        concepto: ConceptoMovimiento.BONIFICACION_RECIBIDA,
        monto: 3000,
        medioPago: MedioPago.EFECTIVO,
        estadoPago: EstadoPago.PAGADO,
        responsableId: 'persona-uuid',
        responsable: { nombre: 'Juan Scout' },
        fecha: new Date('2026-01-11'),
        descripcion: 'Bonificación campamento',
      };
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockMovimientoPago,
        mockMovimientoUseSaldo,
        mockMovimientoGasto,
        mockMovimientoBonificacionOtorgada,
        mockMovimientoBonificacionRecibida,
      ] as any);

      const result = await service.getDetalle('campamento-uuid');

      const participante = result.participantes[0];
      // totalPagado sigue reflejando sólo el pago real: bonificar no cuenta
      // como pago (mismo criterio que en inscripciones).
      expect(participante.totalPagado).toBe(10000);
      expect(participante.pagos).toHaveLength(3);
      const conceptos = participante.pagos.map((p) => p.concepto);
      expect(conceptos).toContain(ConceptoMovimiento.CAMPAMENTO_PAGO);
      expect(conceptos).toContain(ConceptoMovimiento.BONIFICACION_OTORGADA);
      expect(conceptos).toContain(ConceptoMovimiento.BONIFICACION_RECIBIDA);
    });

    it('un educador con montoAsignado 0 aparece EXENTO con saldoPendiente 0', async () => {
      const campamentoConEducadorExento = {
        ...campamentoConParticipante,
        participantes: [
          {
            id: 'cp-educador-uuid',
            campamentoId: 'campamento-uuid',
            personaId: 'educador-uuid',
            autorizacionEntregada: false,
            persona: { nombre: 'Rosa Educadora' },
            montoAsignado: 0,
            montoBonificado: 0,
            deletedAt: null,
          } as unknown as CampamentoParticipante,
        ],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConEducadorExento as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.getDetalle('campamento-uuid');

      const participante = result.participantes[0];
      expect(participante.estadoPago).toBe(EstadoPagoCampamento.EXENTO);
      expect(participante.saldoPendiente).toBe(0);
    });
  });

  describe('getPagosPorParticipante', () => {
    const mockMovimientoPago = {
      id: 'mov-pago-uuid',
      tipo: TipoMovimiento.INGRESO,
      concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
      monto: 10000,
      medioPago: MedioPago.EFECTIVO,
      responsableId: 'persona-uuid',
      fecha: new Date('2026-01-10'),
    };

    it('usa montoAsignado y montoBonificado por participante, no un costoPorPersona uniforme', async () => {
      const campamentoConDosParticipantes = {
        ...mockCampamento,
        participantes: [
          mockCampamentoParticipante as CampamentoParticipante, // montoAsignado 15000
          {
            id: 'cp-educador-uuid',
            personaId: 'educador-uuid',
            persona: { nombre: 'Rosa Educadora' },
            montoAsignado: 0,
            montoBonificado: 0,
          } as CampamentoParticipante,
        ],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConDosParticipantes as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockMovimientoPago,
      ] as any);

      const result = await service.getPagosPorParticipante('campamento-uuid');

      const protagonista = result.find(
        (p) => p.participanteId === 'persona-uuid',
      );
      const educador = result.find((p) => p.participanteId === 'educador-uuid');

      expect(protagonista?.saldoPendiente).toBe(5000); // 15000 - 10000
      expect(educador?.saldoPendiente).toBe(0); // 0 - 0
    });

    it('resta montoBonificado del saldoPendiente', async () => {
      const campamentoConBonificado = {
        ...mockCampamento,
        participantes: [
          {
            ...mockCampamentoParticipante,
            montoAsignado: 15000,
            montoBonificado: 5000,
          } as CampamentoParticipante,
        ],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConBonificado as Campamento,
      );
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockMovimientoPago,
      ] as any);

      const result = await service.getPagosPorParticipante('campamento-uuid');

      // 15000 - 10000 (pagado) - 5000 (bonificado) = 0
      expect(result[0].saldoPendiente).toBe(0);
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
        andWhere: jest.fn().mockReturnThis(),
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

    it('excluye participantes soft-deleted del cálculo de deuda', async () => {
      const qb = buildQueryBuilderMock({ total: '5000', cantidad: '1' });

      await service.getTotalDeudaCampamentos();

      expect(qb.andWhere).toHaveBeenCalledWith('cp."deletedAt" IS NULL');
    });

    it('usa montoAsignado y montoBonificado por participante, no costoPorPersona uniforme', async () => {
      const qb = buildQueryBuilderMock({ total: '5000', cantidad: '1' });

      await service.getTotalDeudaCampamentos();

      const selectSql = qb.select.mock.calls[0][0] as string;
      expect(selectSql).toContain('cp."montoAsignado"');
      expect(selectSql).toContain('cp."montoBonificado"');
      expect(selectSql).not.toContain('c."costoPorPersona"');
    });
  });
});
