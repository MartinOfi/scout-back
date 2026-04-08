import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CuotasService } from './cuotas.service';
import { Cuota } from './entities/cuota.entity';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { EstadoCuota, MedioPago, CajaType } from '../../common/enums';
import { Persona } from '../personas/entities/persona.entity';
import { Caja } from '../cajas/entities/caja.entity';

describe('CuotasService', () => {
  let service: CuotasService;
  let cuotaRepository: jest.Mocked<Repository<Cuota>>;
  let personasService: jest.Mocked<PersonasService>;
  let cajasService: jest.Mocked<CajasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;

  const mockPersona: Partial<Persona> = {
    id: 'persona-uuid',
    nombre: 'Juan Scout',
  };

  const mockCuota: Partial<Cuota> = {
    id: 'cuota-uuid',
    nombre: 'Cuota Marzo 2024',
    ano: 2024,
    montoTotal: 5000,
    montoPagado: 0,
    estado: EstadoCuota.PENDIENTE,
    personaId: 'persona-uuid',
    persona: mockPersona as Persona,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCajaGrupo: Partial<Caja> = {
    id: 'caja-grupo-uuid',
    tipo: CajaType.GRUPO,
  };

  beforeEach(async () => {
    const mockCuotaRepository = {
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
    };

    const mockDeletionValidator = {
      canDeleteCuota: jest.fn().mockResolvedValue({ canDelete: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuotasService,
        {
          provide: getRepositoryToken(Cuota),
          useValue: mockCuotaRepository,
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

    service = module.get<CuotasService>(CuotasService);
    cuotaRepository = module.get(getRepositoryToken(Cuota));
    personasService = module.get(PersonasService);
    cajasService = module.get(CajasService);
    movimientosService = module.get(MovimientosService);
    deletionValidator = module.get(DeletionValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a cuota when found', async () => {
      cuotaRepository.findOne.mockResolvedValue(mockCuota as Cuota);

      const result = await service.findOne('cuota-uuid');

      expect(result).toEqual(mockCuota);
      expect(cuotaRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'cuota-uuid' },
        relations: ['persona'],
      });
    });

    it('should throw NotFoundException when cuota not found', async () => {
      cuotaRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft remove cuota when no movements exist', async () => {
      cuotaRepository.findOne.mockResolvedValue(mockCuota as Cuota);
      deletionValidator.canDeleteCuota.mockResolvedValue({ canDelete: true });
      cuotaRepository.softRemove.mockResolvedValue(mockCuota as Cuota);

      await service.remove('cuota-uuid');

      expect(deletionValidator.canDeleteCuota).toHaveBeenCalledWith(
        'cuota-uuid',
      );
      expect(cuotaRepository.softRemove).toHaveBeenCalledWith(mockCuota);
    });

    it('should throw NotFoundException when cuota does not exist', async () => {
      cuotaRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(deletionValidator.canDeleteCuota).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when cuota has movements', async () => {
      cuotaRepository.findOne.mockResolvedValue(mockCuota as Cuota);
      deletionValidator.canDeleteCuota.mockResolvedValue({
        canDelete: false,
        reason: 'No se puede eliminar: la cuota tiene 2 movimiento(s)',
        movementCount: 2,
      });

      await expect(service.remove('cuota-uuid')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.remove('cuota-uuid')).rejects.toThrow(
        /cuota tiene 2 movimiento/,
      );
      expect(cuotaRepository.softRemove).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a cuota with default values', async () => {
      const dto = {
        nombre: 'Cuota Abril 2024',
        ano: 2024,
        montoTotal: 6000,
        personaId: 'persona-uuid',
      };

      const created = {
        ...dto,
        id: 'new-uuid',
        montoPagado: 0,
        estado: EstadoCuota.PENDIENTE,
      };

      cuotaRepository.create.mockReturnValue(created as Cuota);
      cuotaRepository.save.mockResolvedValue(created as Cuota);

      const result = await service.create(dto);

      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
      expect(cuotaRepository.create).toHaveBeenCalledWith({
        ...dto,
        montoPagado: 0,
        estado: EstadoCuota.PENDIENTE,
      });
      expect(result.estado).toBe(EstadoCuota.PENDIENTE);
      expect(result.montoPagado).toBe(0);
    });

    it('should throw NotFoundException when persona does not exist', async () => {
      personasService.findOne.mockRejectedValue(
        new NotFoundException('Persona no encontrada'),
      );

      const dto = {
        nombre: 'Cuota Test',
        ano: 2024,
        montoTotal: 5000,
        personaId: 'non-existent-persona',
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('registrarPago', () => {
    it('should register payment and update cuota state to PARCIAL', async () => {
      const cuotaPendiente = { ...mockCuota, montoPagado: 0 };
      cuotaRepository.findOne.mockResolvedValue(cuotaPendiente as Cuota);
      cuotaRepository.save.mockImplementation((cuota) =>
        Promise.resolve(cuota as Cuota),
      );

      const result = await service.registrarPago(
        'cuota-uuid',
        2000,
        MedioPago.EFECTIVO,
        'responsable-uuid',
      );

      expect(movimientosService.create).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
      );
      expect(result.montoPagado).toBe(2000);
      expect(result.estado).toBe(EstadoCuota.PARCIAL);
    });

    it('should pass registradoPorId to movimientosService.create', async () => {
      const cuotaPendiente = { ...mockCuota, montoPagado: 0 };
      cuotaRepository.findOne.mockResolvedValue(cuotaPendiente as Cuota);
      cuotaRepository.save.mockImplementation((cuota) =>
        Promise.resolve(cuota as Cuota),
      );

      await service.registrarPago(
        'cuota-uuid',
        2000,
        MedioPago.EFECTIVO,
        'responsable-uuid',
        'educador-uuid',
      );

      expect(movimientosService.create).toHaveBeenCalledWith(
        expect.any(Object),
        'educador-uuid',
      );
    });

    it('should register payment and update cuota state to PAGADO when fully paid', async () => {
      const cuotaParcial = { ...mockCuota, montoPagado: 3000 };
      cuotaRepository.findOne.mockResolvedValue(cuotaParcial as Cuota);
      cuotaRepository.save.mockImplementation((cuota) =>
        Promise.resolve(cuota as Cuota),
      );

      const result = await service.registrarPago(
        'cuota-uuid',
        2000,
        MedioPago.TRANSFERENCIA,
        'responsable-uuid',
      );

      expect(result.montoPagado).toBe(5000);
      expect(result.estado).toBe(EstadoCuota.PAGADO);
    });

    it('should throw BadRequestException when cuota is already fully paid', async () => {
      const cuotaPagada = {
        ...mockCuota,
        montoPagado: 5000,
        estado: EstadoCuota.PAGADO,
      };
      cuotaRepository.findOne.mockResolvedValue(cuotaPagada as Cuota);

      await expect(
        service.registrarPago(
          'cuota-uuid',
          1000,
          MedioPago.EFECTIVO,
          'responsable-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when payment exceeds remaining amount', async () => {
      const cuotaParcial = { ...mockCuota, montoPagado: 4000 };
      cuotaRepository.findOne.mockResolvedValue(cuotaParcial as Cuota);

      await expect(
        service.registrarPago(
          'cuota-uuid',
          2000,
          MedioPago.EFECTIVO,
          'responsable-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByPersona', () => {
    it('should return cuotas for a specific persona', async () => {
      cuotaRepository.find.mockResolvedValue([mockCuota as Cuota]);

      const result = await service.findByPersona('persona-uuid');

      expect(result).toHaveLength(1);
      expect(cuotaRepository.find).toHaveBeenCalledWith({
        where: { personaId: 'persona-uuid' },
        order: { ano: 'DESC', nombre: 'ASC' },
      });
    });
  });

  describe('findByAno', () => {
    it('should return cuotas for a specific year', async () => {
      cuotaRepository.find.mockResolvedValue([mockCuota as Cuota]);

      const result = await service.findByAno(2024);

      expect(result).toHaveLength(1);
      expect(cuotaRepository.find).toHaveBeenCalledWith({
        where: { ano: 2024 },
        relations: ['persona'],
        order: { nombre: 'ASC' },
      });
    });
  });
});
