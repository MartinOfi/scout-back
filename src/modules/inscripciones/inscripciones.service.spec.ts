import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { Inscripcion } from './entities/inscripcion.entity';
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import {
  TipoInscripcion,
  TipoMovimiento,
  EstadoInscripcion,
} from '../../common/enums';

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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all inscriptions ordered by ano DESC', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);

      const result = await service.findAll();

      expect(result).toEqual(inscripciones);
      expect(repository.find).toHaveBeenCalledWith({
        relations: ['persona'],
        order: { ano: 'DESC', createdAt: 'DESC' },
      });
    });
  });

  describe('findByPersona', () => {
    it('should return inscriptions for a specific persona', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);

      const result = await service.findByPersona('persona-uuid');

      expect(result).toEqual(inscripciones);
      expect(repository.find).toHaveBeenCalledWith({
        where: { personaId: 'persona-uuid' },
        order: { ano: 'DESC' },
      });
    });
  });

  describe('findByAno', () => {
    it('should return inscriptions for a specific year', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);

      const result = await service.findByAno(2026);

      expect(result).toEqual(inscripciones);
      expect(repository.find).toHaveBeenCalledWith({
        where: { ano: 2026 },
        relations: ['persona'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should filter by tipo when provided', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);

      const result = await service.findByAno(2026, TipoInscripcion.GRUPO);

      expect(result).toEqual(inscripciones);
      expect(repository.find).toHaveBeenCalledWith({
        where: { ano: 2026, tipo: TipoInscripcion.GRUPO },
        relations: ['persona'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return an inscription by id', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);

      const result = await service.findOne('inscripcion-uuid');

      expect(result).toEqual(mockInscripcion);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'inscripcion-uuid' },
        relations: ['persona'],
      });
    });

    it('should throw NotFoundException when inscription not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
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
      expect(repository.create).toHaveBeenCalledWith({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
        montoBonificado: 0,
        declaracionDeSalud: false,
        autorizacionDeImagen: false,
        salidasCercanas: false,
        autorizacionIngreso: false,
      });
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

    it('should set montoBonificado to 0 when not provided', async () => {
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockInscripcion as Inscripcion);
      repository.save.mockResolvedValue(mockInscripcion as Inscripcion);

      await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ montoBonificado: 0 }),
      );
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
      expect(movimientosService.findByRelatedEntity).toHaveBeenCalledWith(
        'inscripcion',
        'inscripcion-uuid',
      );
    });

    it('should return 0 when no movements exist', async () => {
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.getMontoPagado('inscripcion-uuid');

      expect(result).toBe(0);
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

      const result = await service.getEstado(
        inscripcionConBonificacion as Inscripcion,
      );

      expect(result).toBe(EstadoInscripcion.PAGADO);
    });
  });

  describe('findOneWithEstado', () => {
    it('should return inscription with montoPagado and estado', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 },
      ] as any);

      const result = await service.findOneWithEstado('inscripcion-uuid');

      expect(result.inscripcion).toEqual(mockInscripcion);
      expect(result.montoPagado).toBe(5000);
      expect(result.estado).toBe(EstadoInscripcion.PARCIAL);
    });
  });

  describe('update', () => {
    it('should update authorization fields', async () => {
      const existingInscripcion = { ...mockInscripcion, montoTotal: 10000 };
      repository.findOne.mockResolvedValue(existingInscripcion as Inscripcion);
      repository.save.mockResolvedValue({
        ...existingInscripcion,
        declaracionDeSalud: true,
        autorizacionDeImagen: true,
      } as Inscripcion);

      const result = await service.update('inscripcion-uuid', {
        declaracionDeSalud: true,
        autorizacionDeImagen: true,
      });

      expect(result.declaracionDeSalud).toBe(true);
      expect(result.autorizacionDeImagen).toBe(true);
    });

    it('should update montoBonificado', async () => {
      const existingInscripcion = { ...mockInscripcion, montoTotal: 10000 };
      repository.findOne.mockResolvedValue(existingInscripcion as Inscripcion);
      repository.save.mockResolvedValue({
        ...existingInscripcion,
        montoBonificado: 5000,
      } as Inscripcion);

      const result = await service.update('inscripcion-uuid', {
        montoBonificado: 5000,
      });

      expect(result.montoBonificado).toBe(5000);
    });

    it('should throw if montoBonificado exceeds montoTotal', async () => {
      const existingInscripcion = { ...mockInscripcion, montoTotal: 10000 };
      repository.findOne.mockResolvedValue(existingInscripcion as Inscripcion);

      await expect(
        service.update('inscripcion-uuid', { montoBonificado: 15000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if inscription not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { declaracionDeSalud: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft remove the inscription', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      repository.softRemove.mockResolvedValue(mockInscripcion as Inscripcion);

      await service.remove('inscripcion-uuid');

      expect(repository.softRemove).toHaveBeenCalledWith(mockInscripcion);
    });

    it('should throw NotFoundException if inscription not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
