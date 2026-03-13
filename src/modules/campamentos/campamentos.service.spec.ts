import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CampamentosService } from './campamentos.service';
import { Campamento } from './entities/campamento.entity';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { MedioPago, EstadoPago, CajaType } from '../../common/enums';
import { Persona } from '../personas/entities/persona.entity';
import { Caja } from '../cajas/entities/caja.entity';

describe('CampamentosService', () => {
  let service: CampamentosService;
  let campamentoRepository: jest.Mocked<Repository<Campamento>>;
  let personasService: jest.Mocked<PersonasService>;
  let cajasService: jest.Mocked<CajasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;

  const mockPersona: Partial<Persona> = {
    id: 'persona-uuid',
    nombre: 'Juan Scout',
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampamentosService,
        {
          provide: getRepositoryToken(Campamento),
          useValue: mockCampamentoRepository,
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
          provide: DeletionValidatorService,
          useValue: mockDeletionValidator,
        },
      ],
    }).compile();

    service = module.get<CampamentosService>(CampamentosService);
    campamentoRepository = module.get(getRepositoryToken(Campamento));
    personasService = module.get(PersonasService);
    cajasService = module.get(CajasService);
    movimientosService = module.get(MovimientosService);
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
        relations: ['participantes'],
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
    it('should create a campamento with empty participantes', async () => {
      const dto = {
        nombre: 'Nuevo Campamento',
        fechaInicio: new Date('2024-06-01'),
        fechaFin: new Date('2024-06-05'),
        costoPorPersona: 20000,
      };

      const created = {
        ...dto,
        id: 'new-uuid',
        participantes: [],
      };

      campamentoRepository.create.mockReturnValue(created as Campamento);
      campamentoRepository.save.mockResolvedValue(created as Campamento);

      const result = await service.create(dto);

      expect(campamentoRepository.create).toHaveBeenCalledWith({
        ...dto,
        participantes: [],
      });
      expect(result.participantes).toEqual([]);
    });
  });

  describe('addParticipante', () => {
    it('should add a participant to campamento', async () => {
      const campamentoSinParticipantes = {
        ...mockCampamento,
        participantes: [],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoSinParticipantes as Campamento,
      );
      campamentoRepository.save.mockImplementation((camp) =>
        Promise.resolve(camp as Campamento),
      );

      const result = await service.addParticipante('campamento-uuid', {
        personaId: 'persona-uuid',
      });

      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
      expect(result.participantes).toContainEqual(mockPersona);
    });

    it('should throw BadRequestException when participant already added', async () => {
      const campamentoConParticipante = {
        ...mockCampamento,
        participantes: [mockPersona as Persona],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConParticipante as Campamento,
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
    it('should remove a participant from campamento', async () => {
      const campamentoConParticipante = {
        ...mockCampamento,
        participantes: [mockPersona as Persona],
      };
      campamentoRepository.findOne.mockResolvedValue(
        campamentoConParticipante as Campamento,
      );
      campamentoRepository.save.mockImplementation((camp) =>
        Promise.resolve(camp as Campamento),
      );

      const result = await service.removeParticipante(
        'campamento-uuid',
        'persona-uuid',
      );

      expect(result.participantes).toHaveLength(0);
    });
  });

  describe('registrarPago', () => {
    it('should register payment and create movement', async () => {
      campamentoRepository.findOne.mockResolvedValue(
        mockCampamento as Campamento,
      );

      await service.registrarPago(
        'campamento-uuid',
        'persona-uuid',
        10000,
        MedioPago.EFECTIVO,
      );

      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
      expect(cajasService.findCajaGrupo).toHaveBeenCalled();
      expect(movimientosService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cajaId: 'caja-grupo-uuid',
          monto: 10000,
          campamentoId: 'campamento-uuid',
        }),
      );
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
      );
    });
  });

  describe('getResumenFinanciero', () => {
    it('should return financial summary', async () => {
      const campamentoConParticipantes = {
        ...mockCampamento,
        participantes: [
          mockPersona as Persona,
          { id: 'persona2', nombre: 'Maria' },
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
        relations: ['participantes'],
        order: { fechaInicio: 'DESC' },
      });
    });
  });
});
