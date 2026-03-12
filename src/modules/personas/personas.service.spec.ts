import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PersonasService } from './personas.service';
import {
  Persona,
  Protagonista,
  Educador,
  PersonaExterna,
} from './entities/persona.entity';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { PersonaType, EstadoPersona, Rama, CajaType } from '../../common/enums';
import { Caja } from '../cajas/entities/caja.entity';

describe('PersonasService', () => {
  let service: PersonasService;
  let personaRepository: jest.Mocked<Repository<Persona>>;
  let protagonistaRepository: jest.Mocked<Repository<Protagonista>>;
  let educadorRepository: jest.Mocked<Repository<Educador>>;
  let personaExternaRepository: jest.Mocked<Repository<PersonaExterna>>;
  let cajasService: jest.Mocked<CajasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;

  const mockProtagonista: Partial<Protagonista> = {
    id: 'protagonista-uuid',
    nombre: 'Juan Scout',
    email: 'juan@scout.com',
    tipo: PersonaType.PROTAGONISTA,
    estado: EstadoPersona.ACTIVO,
    rama: Rama.MANADA,
    fechaNacimiento: new Date('2010-05-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockEducador: Partial<Educador> = {
    id: 'educador-uuid',
    nombre: 'María Educadora',
    email: 'maria@scout.com',
    tipo: PersonaType.EDUCADOR,
    estado: EstadoPersona.ACTIVO,
    rama: Rama.MANADA,
    fechaNacimiento: new Date('1990-03-20'),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockPersonaExterna: Partial<PersonaExterna> = {
    id: 'externa-uuid',
    nombre: 'Pedro Externo',
    email: 'pedro@external.com',
    tipo: PersonaType.EXTERNA,
    estado: EstadoPersona.ACTIVO,
    relacion: 'Padre',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCajaPersonal: Partial<Caja> = {
    id: 'caja-personal-uuid',
    nombre: 'Cuenta Personal - Juan Scout',
    tipo: CajaType.PERSONAL,
    personaId: 'protagonista-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockPersonaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockProtagonistaRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockEducadorRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockPersonaExternaRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockCajasService = {
      findCajaPersonal: jest.fn(),
      findCajaGrupo: jest.fn(),
      remove: jest.fn(),
    };

    const mockMovimientosService = {
      calcularSaldo: jest.fn(),
      create: jest.fn(),
    };

    const mockDeletionValidator = {
      canDeletePersona: jest.fn().mockResolvedValue({ canDelete: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonasService,
        {
          provide: getRepositoryToken(Persona),
          useValue: mockPersonaRepository,
        },
        {
          provide: getRepositoryToken(Protagonista),
          useValue: mockProtagonistaRepository,
        },
        {
          provide: getRepositoryToken(Educador),
          useValue: mockEducadorRepository,
        },
        {
          provide: getRepositoryToken(PersonaExterna),
          useValue: mockPersonaExternaRepository,
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

    service = module.get<PersonasService>(PersonasService);
    personaRepository = module.get(getRepositoryToken(Persona));
    protagonistaRepository = module.get(getRepositoryToken(Protagonista));
    educadorRepository = module.get(getRepositoryToken(Educador));
    personaExternaRepository = module.get(getRepositoryToken(PersonaExterna));
    cajasService = module.get(CajasService);
    movimientosService = module.get(MovimientosService);
    deletionValidator = module.get(DeletionValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a persona when found', async () => {
      personaRepository.findOne.mockResolvedValue(
        mockProtagonista as Protagonista,
      );

      const result = await service.findOne('protagonista-uuid');

      expect(result).toEqual(mockProtagonista);
      expect(personaRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'protagonista-uuid' },
      });
    });

    it('should throw NotFoundException when persona not found', async () => {
      personaRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    describe('validation', () => {
      it('should throw NotFoundException when persona does not exist', async () => {
        personaRepository.findOne.mockResolvedValue(null);

        await expect(service.remove('non-existent-id')).rejects.toThrow(
          NotFoundException,
        );
        expect(deletionValidator.canDeletePersona).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when persona has movements as responsable', async () => {
        personaRepository.findOne.mockResolvedValue(
          mockProtagonista as Protagonista,
        );
        deletionValidator.canDeletePersona.mockResolvedValue({
          canDelete: false,
          reason:
            'No se puede eliminar: la persona es responsable de 5 movimiento(s)',
          movementCount: 5,
        });

        await expect(service.remove('protagonista-uuid')).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.remove('protagonista-uuid')).rejects.toThrow(
          /responsable de 5 movimiento/,
        );
        expect(personaRepository.softRemove).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when persona has reimbursements', async () => {
        personaRepository.findOne.mockResolvedValue(
          mockPersonaExterna as PersonaExterna,
        );
        deletionValidator.canDeletePersona.mockResolvedValue({
          canDelete: false,
          reason:
            'No se puede eliminar: la persona tiene 2 reembolso(s) registrado(s)',
          movementCount: 2,
        });

        await expect(service.remove('externa-uuid')).rejects.toThrow(
          BadRequestException,
        );
        expect(personaRepository.softRemove).not.toHaveBeenCalled();
      });
    });

    describe('Protagonista deletion', () => {
      it('should soft remove protagonista and cascade delete caja personal', async () => {
        personaRepository.findOne.mockResolvedValue(
          mockProtagonista as Protagonista,
        );
        deletionValidator.canDeletePersona.mockResolvedValue({
          canDelete: true,
        });
        cajasService.findCajaPersonal.mockResolvedValue(
          mockCajaPersonal as Caja,
        );
        personaRepository.softRemove.mockResolvedValue(
          mockProtagonista as Protagonista,
        );

        await service.remove('protagonista-uuid');

        expect(deletionValidator.canDeletePersona).toHaveBeenCalledWith(
          'protagonista-uuid',
        );
        expect(cajasService.findCajaPersonal).toHaveBeenCalledWith(
          'protagonista-uuid',
        );
        expect(cajasService.remove).toHaveBeenCalledWith('caja-personal-uuid');
        expect(personaRepository.softRemove).toHaveBeenCalledWith(
          mockProtagonista,
        );
      });

      it('should soft remove protagonista without cascade if no caja personal exists', async () => {
        personaRepository.findOne.mockResolvedValue(
          mockProtagonista as Protagonista,
        );
        deletionValidator.canDeletePersona.mockResolvedValue({
          canDelete: true,
        });
        cajasService.findCajaPersonal.mockResolvedValue(null);
        personaRepository.softRemove.mockResolvedValue(
          mockProtagonista as Protagonista,
        );

        await service.remove('protagonista-uuid');

        expect(cajasService.findCajaPersonal).toHaveBeenCalledWith(
          'protagonista-uuid',
        );
        expect(cajasService.remove).not.toHaveBeenCalled();
        expect(personaRepository.softRemove).toHaveBeenCalledWith(
          mockProtagonista,
        );
      });
    });

    describe('Educador deletion', () => {
      it('should soft remove educador and cascade delete caja personal', async () => {
        const educadorCaja: Partial<Caja> = {
          id: 'caja-educador-uuid',
          nombre: 'Cuenta Personal - María Educadora',
          tipo: CajaType.PERSONAL,
          personaId: 'educador-uuid',
        };

        personaRepository.findOne.mockResolvedValue(mockEducador as Educador);
        deletionValidator.canDeletePersona.mockResolvedValue({
          canDelete: true,
        });
        cajasService.findCajaPersonal.mockResolvedValue(educadorCaja as Caja);
        personaRepository.softRemove.mockResolvedValue(
          mockEducador as Educador,
        );

        await service.remove('educador-uuid');

        expect(deletionValidator.canDeletePersona).toHaveBeenCalledWith(
          'educador-uuid',
        );
        expect(cajasService.findCajaPersonal).toHaveBeenCalledWith(
          'educador-uuid',
        );
        expect(cajasService.remove).toHaveBeenCalledWith('caja-educador-uuid');
        expect(personaRepository.softRemove).toHaveBeenCalledWith(mockEducador);
      });

      it('should soft remove educador without cascade if no caja personal exists', async () => {
        personaRepository.findOne.mockResolvedValue(mockEducador as Educador);
        deletionValidator.canDeletePersona.mockResolvedValue({
          canDelete: true,
        });
        cajasService.findCajaPersonal.mockResolvedValue(null);
        personaRepository.softRemove.mockResolvedValue(
          mockEducador as Educador,
        );

        await service.remove('educador-uuid');

        expect(cajasService.findCajaPersonal).toHaveBeenCalledWith(
          'educador-uuid',
        );
        expect(cajasService.remove).not.toHaveBeenCalled();
        expect(personaRepository.softRemove).toHaveBeenCalledWith(mockEducador);
      });
    });

    describe('PersonaExterna deletion', () => {
      it('should soft remove persona externa without checking for caja personal', async () => {
        personaRepository.findOne.mockResolvedValue(
          mockPersonaExterna as PersonaExterna,
        );
        deletionValidator.canDeletePersona.mockResolvedValue({
          canDelete: true,
        });
        personaRepository.softRemove.mockResolvedValue(
          mockPersonaExterna as PersonaExterna,
        );

        await service.remove('externa-uuid');

        expect(deletionValidator.canDeletePersona).toHaveBeenCalledWith(
          'externa-uuid',
        );
        // PersonaExterna should NOT trigger caja personal lookup
        expect(cajasService.findCajaPersonal).not.toHaveBeenCalled();
        expect(cajasService.remove).not.toHaveBeenCalled();
        expect(personaRepository.softRemove).toHaveBeenCalledWith(
          mockPersonaExterna,
        );
      });
    });
  });

  describe('createProtagonista', () => {
    it('should create a protagonista with correct defaults', async () => {
      const dto = {
        nombre: 'Nuevo Scout',
        email: 'nuevo@scout.com',
        rama: Rama.UNIDAD,
        fechaNacimiento: new Date('2012-01-15'),
      };

      const created = {
        ...dto,
        id: 'new-uuid',
        tipo: PersonaType.PROTAGONISTA,
        estado: EstadoPersona.ACTIVO,
      };

      protagonistaRepository.create.mockReturnValue(created as Protagonista);
      protagonistaRepository.save.mockResolvedValue(created as Protagonista);

      const result = await service.createProtagonista(dto);

      expect(protagonistaRepository.create).toHaveBeenCalledWith({
        ...dto,
        tipo: PersonaType.PROTAGONISTA,
        estado: EstadoPersona.ACTIVO,
      });
      expect(result.tipo).toBe(PersonaType.PROTAGONISTA);
      expect(result.estado).toBe(EstadoPersona.ACTIVO);
    });
  });

  describe('createEducador', () => {
    it('should create an educador with correct defaults', async () => {
      const dto = {
        nombre: 'Nuevo Educador',
        email: 'educador@scout.com',
        rama: Rama.CAMINANTES,
        fechaNacimiento: new Date('1985-06-20'),
      };

      const created = {
        ...dto,
        id: 'new-uuid',
        tipo: PersonaType.EDUCADOR,
        estado: EstadoPersona.ACTIVO,
      };

      educadorRepository.create.mockReturnValue(created as Educador);
      educadorRepository.save.mockResolvedValue(created as Educador);

      const result = await service.createEducador(dto);

      expect(educadorRepository.create).toHaveBeenCalledWith({
        ...dto,
        tipo: PersonaType.EDUCADOR,
        estado: EstadoPersona.ACTIVO,
      });
      expect(result.tipo).toBe(PersonaType.EDUCADOR);
      expect(result.estado).toBe(EstadoPersona.ACTIVO);
    });
  });

  describe('createPersonaExterna', () => {
    it('should create a persona externa with correct defaults', async () => {
      const dto = {
        nombre: 'Nueva Persona Externa',
        email: 'externo@email.com',
        relacion: 'Tío',
      };

      const created = {
        ...dto,
        id: 'new-uuid',
        tipo: PersonaType.EXTERNA,
        estado: EstadoPersona.ACTIVO,
      };

      personaExternaRepository.create.mockReturnValue(
        created as PersonaExterna,
      );
      personaExternaRepository.save.mockResolvedValue(
        created as PersonaExterna,
      );

      const result = await service.createPersonaExterna(dto);

      expect(personaExternaRepository.create).toHaveBeenCalledWith({
        ...dto,
        tipo: PersonaType.EXTERNA,
        estado: EstadoPersona.ACTIVO,
      });
      expect(result.tipo).toBe(PersonaType.EXTERNA);
      expect(result.estado).toBe(EstadoPersona.ACTIVO);
    });
  });

  describe('update', () => {
    it('should update persona and return updated entity', async () => {
      const updateDto = { nombre: 'Nombre Actualizado' };
      const updatedPersona = { ...mockProtagonista, ...updateDto };

      personaRepository.findOne.mockResolvedValue(
        mockProtagonista as Protagonista,
      );
      personaRepository.save.mockResolvedValue(updatedPersona as Protagonista);

      const result = await service.update('protagonista-uuid', updateDto);

      expect(result.nombre).toBe('Nombre Actualizado');
      expect(personaRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent persona', async () => {
      personaRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { nombre: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all personas ordered by nombre', async () => {
      const personas = [mockProtagonista, mockEducador, mockPersonaExterna];
      personaRepository.find.mockResolvedValue(personas as Persona[]);

      const result = await service.findAll();

      expect(result).toHaveLength(3);
      expect(personaRepository.find).toHaveBeenCalledWith({
        order: { nombre: 'ASC' },
      });
    });
  });

  describe('findAllByTipo', () => {
    it('should return personas filtered by tipo', async () => {
      personaRepository.find.mockResolvedValue([
        mockProtagonista as Protagonista,
      ]);

      const result = await service.findAllByTipo(PersonaType.PROTAGONISTA);

      expect(result).toHaveLength(1);
      expect(personaRepository.find).toHaveBeenCalledWith({
        where: { tipo: PersonaType.PROTAGONISTA },
        order: { nombre: 'ASC' },
      });
    });
  });

  describe('findAllActivos', () => {
    it('should return only active personas', async () => {
      const activePersonas = [mockProtagonista, mockEducador];
      personaRepository.find.mockResolvedValue(activePersonas as Persona[]);

      const result = await service.findAllActivos();

      expect(result).toHaveLength(2);
      expect(personaRepository.find).toHaveBeenCalledWith({
        where: { estado: EstadoPersona.ACTIVO },
        order: { nombre: 'ASC' },
      });
    });
  });
});
