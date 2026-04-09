import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovimientosService } from './movimientos.service';
import { Movimiento } from './entities/movimiento.entity';
import { CajasService } from '../cajas/cajas.service';
import { PersonasService } from '../personas/personas.service';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
} from '../../common/enums';
import { CreateMovimientoDto } from './dtos/create-movimiento.dto';

describe('MovimientosService', () => {
  let service: MovimientosService;
  let movimientoRepository: jest.Mocked<Repository<Movimiento>>;
  let cajasService: jest.Mocked<CajasService>;
  let personasService: jest.Mocked<PersonasService>;

  const mockCaja = { id: 'caja-uuid' };
  const mockPersona = { id: 'persona-uuid', nombre: 'Juan Scout' };
  const mockMovimiento: Partial<Movimiento> = {
    id: 'mov-uuid',
    cajaId: 'caja-uuid',
    tipo: TipoMovimiento.INGRESO,
    monto: 1000,
    concepto: ConceptoMovimiento.CUOTA_GRUPO,
    responsableId: 'persona-uuid',
    medioPago: MedioPago.EFECTIVO,
    estadoPago: EstadoPago.PAGADO,
    fecha: new Date(),
    registradoPorId: null,
  };

  beforeEach(async () => {
    const mockMovimientoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockReturnValue(mockMovimiento),
      save: jest.fn().mockResolvedValue(mockMovimiento),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockCajasService = {
      findOne: jest.fn().mockResolvedValue(mockCaja),
      findCajaGrupo: jest.fn().mockResolvedValue(mockCaja),
    };

    const mockPersonasService = {
      findOne: jest.fn().mockResolvedValue(mockPersona),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovimientosService,
        {
          provide: getRepositoryToken(Movimiento),
          useValue: mockMovimientoRepository,
        },
        { provide: CajasService, useValue: mockCajasService },
        { provide: PersonasService, useValue: mockPersonasService },
      ],
    }).compile();

    service = module.get<MovimientosService>(MovimientosService);
    movimientoRepository = module.get(getRepositoryToken(Movimiento));
    cajasService = module.get(CajasService);
    personasService = module.get(PersonasService);
  });

  describe('create', () => {
    const baseDto: CreateMovimientoDto = {
      cajaId: 'caja-uuid',
      tipo: TipoMovimiento.INGRESO,
      monto: 1000,
      concepto: ConceptoMovimiento.CUOTA_GRUPO,
      responsableId: 'persona-uuid',
      estadoPago: EstadoPago.PAGADO,
    };

    it('should create a movimiento without registradoPorId when not provided', async () => {
      await service.create(baseDto);

      expect(movimientoRepository.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ registradoPorId: expect.anything() }),
      );
    });

    it('should set registradoPorId when provided', async () => {
      const registradoPorId = 'educador-uuid';

      await service.create(baseDto, registradoPorId);

      expect(movimientoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ registradoPorId }),
      );
    });

    it('should validate caja exists', async () => {
      await service.create(baseDto, 'user-uuid');

      expect(cajasService.findOne).toHaveBeenCalledWith(baseDto.cajaId);
    });

    it('should validate responsable exists', async () => {
      await service.create(baseDto, 'user-uuid');

      expect(personasService.findOne).toHaveBeenCalledWith(
        baseDto.responsableId,
      );
    });

    it('should save and return the created movimiento', async () => {
      const result = await service.create(baseDto, 'user-uuid');

      expect(movimientoRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockMovimiento);
    });
  });

  describe('calcularSaldosBatch', () => {
    it('should return a map of cajaId -> saldo for multiple cajas', async () => {
      const cajaIds = ['caja-1', 'caja-2', 'caja-3'];
      const rawResults = [
        { caja_id: 'caja-1', saldo: '1500' },
        { caja_id: 'caja-2', saldo: '-200' },
      ];

      const mockQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawResults),
      };
      movimientoRepository.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.calcularSaldosBatch(cajaIds);

      expect(result).toBeInstanceOf(Map);
      expect(result.get('caja-1')).toBe(1500);
      expect(result.get('caja-2')).toBe(-200);
      expect(result.get('caja-3')).toBe(0);
      expect(movimientoRepository.createQueryBuilder).toHaveBeenCalledWith('m');
    });

    it('should return empty map for empty input', async () => {
      const result = await service.calcularSaldosBatch([]);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
      expect(movimientoRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('registrarGastoGeneral', () => {
    it('should pass registradoPorId to create', async () => {
      const registradoPorId = 'admin-uuid';
      const createSpy = jest.spyOn(service, 'create');

      await service.registrarGastoGeneral(
        'caja-uuid',
        5000,
        'Materiales',
        'persona-uuid',
        MedioPago.EFECTIVO,
        EstadoPago.PAGADO,
        undefined,
        true,
        registradoPorId,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          concepto: ConceptoMovimiento.GASTO_GENERAL,
          monto: 5000,
        }),
        registradoPorId,
      );
    });

    it('should work without registradoPorId (backward compatible)', async () => {
      const createSpy = jest.spyOn(service, 'create');

      await service.registrarGastoGeneral(
        'caja-uuid',
        5000,
        'Materiales',
        'persona-uuid',
        MedioPago.EFECTIVO,
        EstadoPago.PAGADO,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ monto: 5000 }),
        undefined,
      );
    });
  });
});
