import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CajasService } from './cajas.service';
import { Caja } from './entities/caja.entity';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { CajaType } from '../../common/enums';

describe('CajasService', () => {
  let service: CajasService;
  let cajaRepository: jest.Mocked<Repository<Caja>>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;

  const mockCajaGrupo: Partial<Caja> = {
    id: 'caja-grupo-uuid',
    nombre: 'Caja del Grupo',
    tipo: CajaType.GRUPO,
    propietarioId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCajaRama: Partial<Caja> = {
    id: 'caja-rama-uuid',
    nombre: 'Fondo Manada',
    tipo: CajaType.RAMA_MANADA,
    propietarioId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCajaPersonal: Partial<Caja> = {
    id: 'caja-personal-uuid',
    nombre: 'Cuenta Personal - Juan',
    tipo: CajaType.PERSONAL,
    propietarioId: 'persona-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockCajaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockDeletionValidator = {
      canDeleteCaja: jest.fn().mockResolvedValue({ canDelete: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajasService,
        {
          provide: getRepositoryToken(Caja),
          useValue: mockCajaRepository,
        },
        {
          provide: DeletionValidatorService,
          useValue: mockDeletionValidator,
        },
      ],
    }).compile();

    service = module.get<CajasService>(CajasService);
    cajaRepository = module.get(getRepositoryToken(Caja));
    deletionValidator = module.get(DeletionValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a caja when found', async () => {
      cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);

      const result = await service.findOne('caja-personal-uuid');

      expect(result).toEqual(mockCajaPersonal);
      expect(cajaRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'caja-personal-uuid' },
        relations: ['propietario'],
      });
    });

    it('should throw NotFoundException when caja not found', async () => {
      cajaRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    describe('validation', () => {
      it('should throw BadRequestException when trying to delete caja de grupo', async () => {
        cajaRepository.findOne.mockResolvedValue(mockCajaGrupo as Caja);

        await expect(service.remove('caja-grupo-uuid')).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.remove('caja-grupo-uuid')).rejects.toThrow(
          /No se puede eliminar la caja del grupo/,
        );
        expect(deletionValidator.canDeleteCaja).not.toHaveBeenCalled();
        expect(cajaRepository.softRemove).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException when caja does not exist', async () => {
        cajaRepository.findOne.mockResolvedValue(null);

        await expect(service.remove('non-existent-id')).rejects.toThrow(
          NotFoundException,
        );
        expect(deletionValidator.canDeleteCaja).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when caja has movements', async () => {
        cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);
        deletionValidator.canDeleteCaja.mockResolvedValue({
          canDelete: false,
          reason: 'No se puede eliminar: la caja tiene 5 movimiento(s)',
          movementCount: 5,
        });

        await expect(service.remove('caja-personal-uuid')).rejects.toThrow(
          BadRequestException,
        );
        expect(cajaRepository.softRemove).not.toHaveBeenCalled();
      });
    });

    describe('successful deletion', () => {
      it('should soft remove caja personal when no movements exist', async () => {
        cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);
        deletionValidator.canDeleteCaja.mockResolvedValue({ canDelete: true });
        cajaRepository.softRemove.mockResolvedValue(mockCajaPersonal as Caja);

        await service.remove('caja-personal-uuid');

        expect(deletionValidator.canDeleteCaja).toHaveBeenCalledWith(
          'caja-personal-uuid',
        );
        expect(cajaRepository.softRemove).toHaveBeenCalledWith(mockCajaPersonal);
      });

      it('should soft remove caja de rama when no movements exist', async () => {
        cajaRepository.findOne.mockResolvedValue(mockCajaRama as Caja);
        deletionValidator.canDeleteCaja.mockResolvedValue({ canDelete: true });
        cajaRepository.softRemove.mockResolvedValue(mockCajaRama as Caja);

        await service.remove('caja-rama-uuid');

        expect(deletionValidator.canDeleteCaja).toHaveBeenCalledWith(
          'caja-rama-uuid',
        );
        expect(cajaRepository.softRemove).toHaveBeenCalledWith(mockCajaRama);
      });
    });
  });

  describe('findCajaGrupo', () => {
    it('should return the group caja', async () => {
      cajaRepository.findOne.mockResolvedValue(mockCajaGrupo as Caja);

      const result = await service.findCajaGrupo();

      expect(result).toEqual(mockCajaGrupo);
      expect(cajaRepository.findOne).toHaveBeenCalledWith({
        where: { tipo: CajaType.GRUPO },
      });
    });

    it('should throw NotFoundException when group caja does not exist', async () => {
      cajaRepository.findOne.mockResolvedValue(null);

      await expect(service.findCajaGrupo()).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCajaPersonal', () => {
    it('should return personal caja for a propietario', async () => {
      cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);

      const result = await service.findCajaPersonal('persona-uuid');

      expect(result).toEqual(mockCajaPersonal);
      expect(cajaRepository.findOne).toHaveBeenCalledWith({
        where: { tipo: CajaType.PERSONAL, propietarioId: 'persona-uuid' },
        relations: ['propietario'],
      });
    });

    it('should return null when personal caja does not exist', async () => {
      cajaRepository.findOne.mockResolvedValue(null);

      const result = await service.findCajaPersonal('non-existent-persona');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a personal caja', async () => {
      const dto = {
        tipo: CajaType.PERSONAL,
        propietarioId: 'new-persona-uuid',
      };

      const created = {
        id: 'new-caja-uuid',
        nombre: 'Cuenta Personal',
        ...dto,
      };

      cajaRepository.findOne.mockResolvedValue(null);
      cajaRepository.create.mockReturnValue(created as Caja);
      cajaRepository.save.mockResolvedValue(created as Caja);

      const result = await service.create(dto);

      expect(result.tipo).toBe(CajaType.PERSONAL);
      expect(cajaRepository.create).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException when creating second grupo caja', async () => {
      const dto = { tipo: CajaType.GRUPO };

      cajaRepository.findOne.mockResolvedValue(mockCajaGrupo as Caja);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /Ya existe una caja de grupo/,
      );
    });

    it('should throw BadRequestException when personal caja without propietario', async () => {
      const dto = { tipo: CajaType.PERSONAL };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /cajas personales requieren un propietario/,
      );
    });

    it('should throw BadRequestException when persona already has personal caja', async () => {
      const dto = {
        tipo: CajaType.PERSONAL,
        propietarioId: 'persona-uuid',
      };

      cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /ya tiene una caja personal/,
      );
    });
  });

  describe('getOrCreateCajaPersonal', () => {
    it('should return existing personal caja', async () => {
      cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);

      const result = await service.getOrCreateCajaPersonal('persona-uuid');

      expect(result).toEqual(mockCajaPersonal);
      expect(cajaRepository.create).not.toHaveBeenCalled();
    });

    it('should create new personal caja when none exists', async () => {
      const newCaja = {
        id: 'new-caja-uuid',
        tipo: CajaType.PERSONAL,
        propietarioId: 'new-persona-uuid',
      };

      cajaRepository.findOne.mockResolvedValue(null);
      cajaRepository.create.mockReturnValue(newCaja as Caja);
      cajaRepository.save.mockResolvedValue(newCaja as Caja);

      const result = await service.getOrCreateCajaPersonal('new-persona-uuid');

      expect(cajaRepository.create).toHaveBeenCalledWith({
        tipo: CajaType.PERSONAL,
        propietarioId: 'new-persona-uuid',
      });
      expect(cajaRepository.save).toHaveBeenCalled();
      expect(result.tipo).toBe(CajaType.PERSONAL);
    });
  });

  describe('findByTipo', () => {
    it('should return cajas filtered by tipo', async () => {
      cajaRepository.find.mockResolvedValue([mockCajaRama as Caja]);

      const result = await service.findByTipo(CajaType.RAMA_MANADA);

      expect(result).toHaveLength(1);
      expect(cajaRepository.find).toHaveBeenCalledWith({
        where: { tipo: CajaType.RAMA_MANADA },
        relations: ['propietario'],
      });
    });
  });

  describe('findAll', () => {
    it('should return all cajas ordered by tipo and nombre', async () => {
      const cajas = [mockCajaGrupo, mockCajaRama, mockCajaPersonal];
      cajaRepository.find.mockResolvedValue(cajas as Caja[]);

      const result = await service.findAll();

      expect(result).toHaveLength(3);
      expect(cajaRepository.find).toHaveBeenCalledWith({
        relations: ['propietario'],
        order: { tipo: 'ASC', nombre: 'ASC' },
      });
    });
  });
});
