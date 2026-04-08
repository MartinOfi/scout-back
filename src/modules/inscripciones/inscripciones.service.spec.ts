import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InscripcionesService } from './inscripciones.service';
import { Inscripcion } from './entities/inscripcion.entity';
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { PagosService } from '../pagos/pagos.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import {
  TipoInscripcion,
  TipoMovimiento,
  EstadoInscripcion,
  MedioPago,
  ConceptoMovimiento,
  TipoDeuda,
} from '../../common/enums';

describe('InscripcionesService', () => {
  let service: InscripcionesService;
  let repository: jest.Mocked<Repository<Inscripcion>>;
  let personasService: jest.Mocked<PersonasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let pagosService: jest.Mocked<PagosService>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;
  let dataSource: jest.Mocked<DataSource>;

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

  // Mock EntityManager for transactions
  const createMockManager = (
    repository: jest.Mocked<Repository<Inscripcion>>,
  ): jest.Mocked<EntityManager> =>
    ({
      create: jest.fn().mockImplementation((_, data) => data),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: repository.findOne,
    }) as unknown as jest.Mocked<EntityManager>;

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const mockManager = createMockManager(
          mockRepository as jest.Mocked<Repository<Inscripcion>>,
        );
        return cb(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InscripcionesService,
        {
          provide: getRepositoryToken(Inscripcion),
          useValue: mockRepository,
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
            findByInscripcionIds: jest.fn().mockResolvedValue(new Map()),
            create: jest.fn(),
          },
        },
        {
          provide: PagosService,
          useValue: {
            ejecutarPagoConManager: jest.fn().mockResolvedValue({
              movimientoIngreso: { id: 'mov-id', monto: 5000 },
              desglose: {
                montoSaldoPersonal: 0,
                montoFisico: 5000,
                total: 5000,
              },
            }),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: DeletionValidatorService,
          useValue: {
            canDeleteInscripcion: jest
              .fn()
              .mockResolvedValue({ canDelete: true }),
          },
        },
      ],
    }).compile();

    service = module.get<InscripcionesService>(InscripcionesService);
    repository = module.get(getRepositoryToken(Inscripcion));
    personasService = module.get(PersonasService);
    movimientosService = module.get(MovimientosService);
    pagosService = module.get(PagosService);
    deletionValidator = module.get(DeletionValidatorService);
    dataSource = module.get(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all inscriptions with calculated fields', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);
      movimientosService.findByInscripcionIds.mockResolvedValue(new Map());

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inscripcion-uuid');
      expect(result[0].estado).toBe(EstadoInscripcion.PENDIENTE);
      expect(result[0].montoPagado).toBe(0);
      expect(result[0].saldoPendiente).toBe(10000);
      expect(repository.find).toHaveBeenCalledWith({
        where: undefined,
        relations: ['persona'],
        order: { ano: 'DESC', createdAt: 'DESC' },
      });
    });

    it('should filter by ano when provided', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);
      movimientosService.findByInscripcionIds.mockResolvedValue(new Map());

      const result = await service.findAll({ ano: 2026 });

      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { ano: 2026 },
        relations: ['persona'],
        order: { ano: 'DESC', createdAt: 'DESC' },
      });
    });

    it('should filter by tipo when provided', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);
      movimientosService.findByInscripcionIds.mockResolvedValue(new Map());

      const result = await service.findAll({ tipo: TipoInscripcion.GRUPO });

      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { tipo: TipoInscripcion.GRUPO },
        relations: ['persona'],
        order: { ano: 'DESC', createdAt: 'DESC' },
      });
    });

    it('should filter deudores with saldo pendiente', async () => {
      const inscripcionConDeuda = {
        ...mockInscripcion,
        id: 'con-deuda',
        montoTotal: 10000,
      };
      const inscripcionPagada = {
        ...mockInscripcion,
        id: 'pagada',
        montoTotal: 10000,
      };
      repository.find.mockResolvedValue([
        inscripcionConDeuda,
        inscripcionPagada,
      ] as Inscripcion[]);

      // Mock diferentes pagos para cada inscripción via batch
      movimientosService.findByInscripcionIds.mockResolvedValue(
        new Map([
          ['con-deuda', []], // no payments
          ['pagada', [{ tipo: TipoMovimiento.INGRESO, monto: 10000 }] as any], // fully paid
        ]),
      );

      const result = await service.findAll({ tipoDeuda: TipoDeuda.DINERO });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('con-deuda');
      expect(result[0].saldoPendiente).toBeGreaterThan(0);
    });

    it('should filter deudores with missing documents for SCOUT_ARGENTINA', async () => {
      const inscripcionSinDocumentos = {
        ...mockInscripcion,
        id: 'sin-docs',
        tipo: TipoInscripcion.SCOUT_ARGENTINA,
        montoTotal: 10000,
        declaracionDeSalud: false,
        autorizacionDeImagen: true,
        salidasCercanas: true,
        autorizacionIngreso: true,
        certificadoAptitudFisica: true,
      };
      const inscripcionCompleta = {
        ...mockInscripcion,
        id: 'completa',
        tipo: TipoInscripcion.SCOUT_ARGENTINA,
        montoTotal: 10000,
        declaracionDeSalud: true,
        autorizacionDeImagen: true,
        salidasCercanas: true,
        autorizacionIngreso: true,
        certificadoAptitudFisica: true,
      };
      repository.find.mockResolvedValue([
        inscripcionSinDocumentos,
        inscripcionCompleta,
      ] as Inscripcion[]);

      // Ambas completamente pagadas
      movimientosService.findByInscripcionIds.mockResolvedValue(
        new Map([
          ['sin-docs', [{ tipo: TipoMovimiento.INGRESO, monto: 10000 }] as any],
          ['completa', [{ tipo: TipoMovimiento.INGRESO, monto: 10000 }] as any],
        ]),
      );

      const result = await service.findAll({
        tipoDeuda: TipoDeuda.DOCUMENTACION,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sin-docs');
      expect(result[0].declaracionDeSalud).toBe(false);
    });

    it('should not consider missing documents for GRUPO type when filtering deudores', async () => {
      const inscripcionGrupoPagada = {
        ...mockInscripcion,
        id: 'grupo-pagada',
        tipo: TipoInscripcion.GRUPO,
        montoTotal: 10000,
        declaracionDeSalud: false, // Los docs en false no importan para GRUPO
        autorizacionDeImagen: false,
      };
      repository.find.mockResolvedValue([
        inscripcionGrupoPagada,
      ] as Inscripcion[]);

      // Completamente pagada
      movimientosService.findByInscripcionIds.mockResolvedValue(
        new Map([
          [
            'grupo-pagada',
            [{ tipo: TipoMovimiento.INGRESO, monto: 10000 }] as any,
          ],
        ]),
      );

      const result = await service.findAll({
        tipoDeuda: TipoDeuda.DOCUMENTACION,
      });

      // No debe aparecer porque está pagada y los docs no aplican a GRUPO
      expect(result).toHaveLength(0);
    });

    it('should return all inscriptions when deudores is false', async () => {
      const inscripcionPagada = {
        ...mockInscripcion,
        id: 'pagada',
        montoTotal: 10000,
      };
      repository.find.mockResolvedValue([inscripcionPagada] as Inscripcion[]);
      movimientosService.findByInscripcionIds.mockResolvedValue(
        new Map([
          ['pagada', [{ tipo: TipoMovimiento.INGRESO, monto: 10000 }] as any],
        ]),
      );

      const result = await service.findAll({ deudores: false });

      expect(result).toHaveLength(1);
    });
  });

  describe('findByPersona', () => {
    it('should return inscriptions for a specific persona with calculated fields', async () => {
      const inscripciones = [mockInscripcion as Inscripcion];
      repository.find.mockResolvedValue(inscripciones);
      movimientosService.findByInscripcionIds.mockResolvedValue(new Map());

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
      movimientosService.findByInscripcionIds.mockResolvedValue(new Map());

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
      movimientosService.findByInscripcionIds.mockResolvedValue(new Map());

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
      repository.findOne.mockResolvedValueOnce(null); // Check for existing
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const mockManager = {
          create: jest.fn().mockReturnValue(mockInscripcion),
          save: jest.fn().mockResolvedValue(mockInscripcion),
          findOne: jest.fn().mockResolvedValue(mockInscripcion),
        };
        return cb(mockManager);
      });

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
      repository.findOne.mockResolvedValueOnce(null);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      let capturedCreateData: any;
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const mockManager = {
          create: jest.fn().mockImplementation((_, data) => {
            capturedCreateData = data;
            return mockInscripcion;
          }),
          save: jest.fn().mockResolvedValue(mockInscripcion),
          findOne: jest.fn().mockResolvedValue(mockInscripcion),
        };
        return cb(mockManager);
      });

      await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
      });

      expect(capturedCreateData).toEqual(
        expect.objectContaining({ montoBonificado: 0 }),
      );
    });

    it('should call pagosService when montoPagado > 0', async () => {
      const savedInscripcion = {
        ...mockInscripcion,
        id: 'new-inscripcion-uuid',
      };
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne.mockResolvedValueOnce(null); // Check for existing
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 },
      ] as any);

      // Mock the transaction to simulate what happens inside
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const mockManager = {
          create: jest.fn().mockReturnValue(savedInscripcion),
          save: jest.fn().mockResolvedValue(savedInscripcion),
          findOne: jest.fn().mockResolvedValue(savedInscripcion),
        };
        return cb(mockManager);
      });

      const result = await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
        montoPagado: 5000,
        medioPago: MedioPago.EFECTIVO,
      });

      expect(pagosService.ejecutarPagoConManager).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          personaId: 'persona-uuid',
          montoTotal: 5000,
          concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
          inscripcionId: 'new-inscripcion-uuid',
        }),
      );
      expect(result.montoPagado).toBe(5000);
    });

    it('should use efectivo as default medioPago when not provided', async () => {
      const savedInscripcion = {
        ...mockInscripcion,
        id: 'new-inscripcion-uuid',
      };
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne.mockResolvedValueOnce(null);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 5000 } as any,
      ]);

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const mockManager = {
          create: jest.fn().mockReturnValue(savedInscripcion),
          save: jest.fn().mockResolvedValue(savedInscripcion),
          findOne: jest.fn().mockResolvedValue(savedInscripcion),
        };
        return cb(mockManager);
      });

      const result = await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
        montoPagado: 5000,
      });

      // When medioPago is not provided, pagosService uses efectivo by default
      expect(pagosService.ejecutarPagoConManager).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          montoTotal: 5000,
          medioPago: undefined, // Service passes undefined, PagosService defaults to EFECTIVO
        }),
      );
      expect(result.montoPagado).toBe(5000);
    });

    it('should not call pagosService when montoPagado is 0', async () => {
      personasService.findOne.mockResolvedValue({ id: 'persona-uuid' } as any);
      repository.findOne.mockResolvedValueOnce(null);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const mockManager = {
          create: jest.fn().mockReturnValue(mockInscripcion),
          save: jest.fn().mockResolvedValue(mockInscripcion),
          findOne: jest.fn().mockResolvedValue(mockInscripcion),
        };
        return cb(mockManager);
      });

      await service.registrarInscripcion({
        personaId: 'persona-uuid',
        tipo: TipoInscripcion.GRUPO,
        ano: 2026,
        montoTotal: 10000,
        montoPagado: 0,
      });

      expect(pagosService.ejecutarPagoConManager).not.toHaveBeenCalled();
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
    it('should soft remove the inscription when no movements exist', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      repository.softRemove.mockResolvedValue(mockInscripcion as Inscripcion);
      deletionValidator.canDeleteInscripcion.mockResolvedValue({
        canDelete: true,
      });

      await service.remove('inscripcion-uuid');

      expect(deletionValidator.canDeleteInscripcion).toHaveBeenCalledWith(
        'inscripcion-uuid',
      );
      expect(repository.softRemove).toHaveBeenCalledWith(mockInscripcion);
    });

    it('should throw NotFoundException if inscription not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when inscription has movements', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      deletionValidator.canDeleteInscripcion.mockResolvedValue({
        canDelete: false,
        reason: 'No se puede eliminar: la inscripción tiene 3 movimiento(s)',
        movementCount: 3,
      });

      await expect(service.remove('inscripcion-uuid')).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.softRemove).not.toHaveBeenCalled();
    });
  });

  describe('pagar', () => {
    it('should process payment and return updated inscription', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity
        .mockResolvedValueOnce([]) // For getMontoPagado
        .mockResolvedValueOnce([
          { tipo: TipoMovimiento.INGRESO, monto: 5000 },
        ] as any); // For toResponseDto

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        const mockManager = {};
        return cb(mockManager);
      });

      const result = await service.pagar('inscripcion-uuid', {
        montoPagado: 5000,
      });

      expect(pagosService.ejecutarPagoConManager).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          personaId: 'persona-uuid',
          montoTotal: 5000,
          montoConSaldoPersonal: 0,
          concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
          inscripcionId: 'inscripcion-uuid',
        }),
      );
      expect(result.id).toBe('inscripcion-uuid');
    });

    it('should throw NotFoundException when inscription not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.pagar('non-existent-id', { montoPagado: 5000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when inscription is fully paid', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 10000 },
      ] as any);

      await expect(
        service.pagar('inscripcion-uuid', { montoPagado: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when monto exceeds saldoPendiente', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        { tipo: TipoMovimiento.INGRESO, monto: 8000 },
      ] as any); // saldoPendiente = 2000

      await expect(
        service.pagar('inscripcion-uuid', { montoPagado: 5000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when total payment (montoPagado + montoConSaldoPersonal) exceeds saldo pendiente', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      // saldoPendiente = 10000, total payment = 5000 + 6000 = 11000 > 10000
      await expect(
        service.pagar('inscripcion-uuid', {
          montoPagado: 5000,
          montoConSaldoPersonal: 6000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow montoConSaldoPersonal to exceed montoPagado when total does not exceed saldo', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb({});
      });

      // montoConSaldoPersonal (6000) > montoPagado (3000), but total (9000) < saldoPendiente (10000)
      await service.pagar('inscripcion-uuid', {
        montoPagado: 3000,
        montoConSaldoPersonal: 6000,
      });

      expect(pagosService.ejecutarPagoConManager).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          montoTotal: 9000, // montoPagado + montoConSaldoPersonal
          montoConSaldoPersonal: 6000,
        }),
      );
    });

    it('should use SCOUT_ARGENTINA concept for scout inscriptions', async () => {
      const scoutInscripcion = {
        ...mockInscripcion,
        tipo: TipoInscripcion.SCOUT_ARGENTINA,
      };
      repository.findOne.mockResolvedValue(scoutInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb({});
      });

      await service.pagar('inscripcion-uuid', { montoPagado: 5000 });

      expect(pagosService.ejecutarPagoConManager).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          concepto: ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA,
        }),
      );
    });

    it('should pass medioPago to pagosService', async () => {
      repository.findOne.mockResolvedValue(mockInscripcion as Inscripcion);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
        return cb({});
      });

      await service.pagar('inscripcion-uuid', {
        montoPagado: 5000,
        medioPago: MedioPago.TRANSFERENCIA,
      });

      expect(pagosService.ejecutarPagoConManager).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          medioPago: MedioPago.TRANSFERENCIA,
        }),
      );
    });
  });
});
