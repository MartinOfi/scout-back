import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { Inscripcion } from './entities/inscripcion.entity';
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { CajasService } from '../cajas/cajas.service';
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
  let cajasService: jest.Mocked<CajasService>;

  const mockInscripcion: Partial<Inscripcion> = {
    id: 'inscripcion-uuid',
    personaId: 'persona-uuid',
    tipo: TipoInscripcion.GRUPO,
    ano: 2026,
    montoTotal: 10000,
    montoBonificado: 0,
    declaracionDeSalud: false,
    autorizacionDeImagen: false,
    salidasCercanas: false,
    autorizacionIngreso: false,
    createdAt: new Date(),
    updatedAt: new Date(),
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
            findByRelatedEntity: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
          },
        },
        {
          provide: CajasService,
          useValue: {
            findCajaGrupo: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InscripcionesService>(InscripcionesService);
    repository = module.get(getRepositoryToken(Inscripcion));
    personasService = module.get(PersonasService);
    movimientosService = module.get(MovimientosService);
    cajasService = module.get(CajasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all inscriptions with calculated fields', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inscripcion-uuid');
      expect(result[0].estado).toBe(EstadoInscripcion.PENDIENTE);
      expect(result[0].montoPagado).toBe(0);
      expect(result[0].saldoPendiente).toBe(10000);
      expect(repository.find).toHaveBeenCalledWith({
        relations: ['persona'],
        order: { ano: 'DESC', createdAt: 'DESC' },
      });
    });
  });

  describe('findByPersona', () => {
    it('should return inscriptions for a specific persona with calculated fields', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.findByPersona('persona-uuid');

      expect(result).toHaveLength(1);
      expect(result[0].estado).toBe(EstadoInscripcion.PENDIENTE);
      expect(repository.find).toHaveBeenCalledWith({
        where: { personaId: 'persona-uuid' },
        relations: ['persona'],
        order: { ano: 'DESC' },
      });
    });
  });

  describe('findByAno', () => {
    it('should return inscriptions for a specific year with calculated fields', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.findByAno(2026);

      expect(result).toHaveLength(1);
      expect(result[0].estado).toBe(EstadoInscripcion.PENDIENTE);
      expect(repository.find).toHaveBeenCalledWith({
        where: { ano: 2026 },
        relations: ['persona'],
        order: { createdAt: 'DESC' },
      });
    });

    it('should filter by tipo when provided', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.findByAno(2026, TipoInscripcion.GRUPO);

      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { ano: 2026, tipo: TipoInscripcion.GRUPO },
        relations: ['persona'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return an inscription with calculated fields', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 },
      ] as any);

      const result = await service.findOne('inscripcion-uuid');

      expect(result.id).toBe('inscripcion-uuid');
      expect(result.estado).toBe(EstadoInscripcion.PARCIAL);
      expect(result.montoPagado).toBe(5000);
      expect(result.saldoPendiente).toBe(5000);
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
    it('should create inscription and return with calculated fields', async () => {
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne
        .mockResolvedValueOnce(null) // Check for existing
        .mockResolvedValueOnce(mockInscripcion as Inscripcion); // Reload after save
      repository.create.mockReturnValue(mockInscripcion as Inscripcion);
      repository.save.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
      });

      expect(result.id).toBe('inscripcion-uuid');
      expect(result.estado).toBe(EstadoInscripcion.PENDIENTE);
      expect(result.montoPagado).toBe(0);
      expect(result.saldoPendiente).toBe(10000);
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
      repository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockInscripcion as Inscripcion);
      repository.create.mockReturnValue(mockInscripcion as Inscripcion);
      repository.save.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

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

    it('should create movimiento when montoPagado > 0', async () => {
      const savedInscripcion = {
        ...mockInscripcion,
        id: 'new-inscripcion-uuid',
      };
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(savedInscripcion as Inscripcion);
      repository.create.mockReturnValue(savedInscripcion as Inscripcion);
      repository.save.mockResolvedValue(savedInscripcion as Inscripcion);
      cajasService.findCajaGrupo.mockResolvedValue({
        id: 'caja-grupo-uuid',
      } as any);
      movimientosService.create.mockResolvedValue({} as any);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 },
      ] as any);

      const result = await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
        montoPagado: 5000,
        medioPago: 'efectivo' as any,
      });

      expect(cajasService.findCajaGrupo).toHaveBeenCalled();
      expect(movimientosService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cajaId: 'caja-grupo-uuid',
          tipo: TipoMovimiento.INGRESO,
          monto: 5000,
          inscripcionId: 'new-inscripcion-uuid',
        }),
      );
      expect(result.montoPagado).toBe(5000);
    });

    it('should create movimiento with undefined medioPago when montoPagado > 0', async () => {
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockInscripcion as Inscripcion);
      repository.create.mockReturnValue({
        ...mockInscripcion,
        id: 'new-inscripcion-uuid',
      } as Inscripcion);
      repository.save.mockResolvedValue({
        ...mockInscripcion,
        id: 'new-inscripcion-uuid',
      } as Inscripcion);
      cajasService.findCajaGrupo.mockResolvedValue({
        id: 'caja-grupo-uuid',
      } as any);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 } as any,
      ]);

      const result = await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
        montoPagado: 5000,
      });

      expect(cajasService.findCajaGrupo).toHaveBeenCalled();
      expect(movimientosService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cajaId: 'caja-grupo-uuid',
          monto: 5000,
          medioPago: undefined,
        }),
      );
      expect(result.montoPagado).toBe(5000);
    });

    it('should not create movimiento when montoPagado is 0', async () => {
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockInscripcion as Inscripcion);
      repository.create.mockReturnValue(mockInscripcion as Inscripcion);
      repository.save.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
        montoPagado: 0,
      });

      expect(cajasService.findCajaGrupo).not.toHaveBeenCalled();
      expect(movimientosService.create).not.toHaveBeenCalled();
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
    it('should return inscription response DTO (same as findOne)', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 },
      ] as any);

      const result = await service.findOneWithEstado('inscripcion-uuid');

      expect(result.id).toBe('inscripcion-uuid');
      expect(result.montoPagado).toBe(5000);
      expect(result.estado).toBe(EstadoInscripcion.PARCIAL);
      expect(result.saldoPendiente).toBe(5000);
    });
  });

  describe('update', () => {
    it('should update authorization fields on SCOUT_ARGENTINA', async () => {
      const existingInscripcion = {
        ...mockInscripcion,
        tipo: TipoInscripcion.SCOUT_ARGENTINA,
        montoTotal: 10000,
      };
      repository.findOne.mockResolvedValue(existingInscripcion as Inscripcion);
      repository.save.mockResolvedValue({
        ...existingInscripcion,
        declaracionDeSalud: true,
        autorizacionDeImagen: true,
      } as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.update('inscripcion-uuid', {
        declaracionDeSalud: true,
        autorizacionDeImagen: true,
      });

      expect(result.declaracionDeSalud).toBe(true);
      expect(result.autorizacionDeImagen).toBe(true);
      expect(result.estado).toBe(EstadoInscripcion.PENDIENTE);
    });

    it('should update montoBonificado on any inscription type', async () => {
      const existingInscripcion = {
        ...mockInscripcion,
        tipo: TipoInscripcion.GRUPO,
        montoTotal: 10000,
      };
      repository.findOne.mockResolvedValue(existingInscripcion as Inscripcion);
      repository.save.mockResolvedValue({
        ...existingInscripcion,
        montoBonificado: 5000,
      } as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.update('inscripcion-uuid', {
        montoBonificado: 5000,
      });

      expect(result.montoBonificado).toBe(5000);
      expect(result.saldoPendiente).toBe(5000); // 10000 - 5000 bonificado
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

    it('should throw if trying to update authorization fields on GRUPO inscription', async () => {
      const grupoInscripcion = {
        ...mockInscripcion,
        tipo: TipoInscripcion.GRUPO,
        montoTotal: 10000,
      };
      repository.findOne.mockResolvedValue(grupoInscripcion as Inscripcion);

      await expect(
        service.update('inscripcion-uuid', { declaracionDeSalud: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow updating authorization fields on SCOUT_ARGENTINA inscription', async () => {
      const scoutArgentinaInscripcion = {
        ...mockInscripcion,
        tipo: TipoInscripcion.SCOUT_ARGENTINA,
        montoTotal: 10000,
      };
      repository.findOne.mockResolvedValue(
        scoutArgentinaInscripcion as Inscripcion,
      );
      repository.save.mockResolvedValue({
        ...scoutArgentinaInscripcion,
        declaracionDeSalud: true,
      } as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.update('inscripcion-uuid', {
        declaracionDeSalud: true,
      });

      expect(result.declaracionDeSalud).toBe(true);
    });

    it('should allow updating montoBonificado on GRUPO inscription', async () => {
      const grupoInscripcion = {
        ...mockInscripcion,
        tipo: TipoInscripcion.GRUPO,
        montoTotal: 10000,
      };
      repository.findOne.mockResolvedValue(grupoInscripcion as Inscripcion);
      repository.save.mockResolvedValue({
        ...grupoInscripcion,
        montoBonificado: 3000,
      } as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.update('inscripcion-uuid', {
        montoBonificado: 3000,
      });

      expect(result.montoBonificado).toBe(3000);
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
