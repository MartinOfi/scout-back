import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { MovimientosService } from './movimientos.service';
import { Movimiento } from './entities/movimiento.entity';
import { CajasService } from '../cajas/cajas.service';
import { PersonasService } from '../personas/personas.service';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
  CategoriaMovimiento,
} from '../../common/enums';
import { CreateMovimientoDto } from './dtos/create-movimiento.dto';

describe('MovimientosService', () => {
  let service: MovimientosService;
  let movimientoRepository: jest.Mocked<Repository<Movimiento>>;
  let cajasService: jest.Mocked<CajasService>;
  let personasService: jest.Mocked<PersonasService>;
  let dataSource: jest.Mocked<DataSource>;

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

    const mockDataSource = {
      transaction: jest.fn(),
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
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<MovimientosService>(MovimientosService);
    movimientoRepository = module.get(getRepositoryToken(Movimiento));
    cajasService = module.get(CajasService);
    personasService = module.get(PersonasService);
    dataSource = module.get(DataSource);
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

    it('debe persistir el campo categoria cuando viene en el DTO', async () => {
      const dtoConCategoria: CreateMovimientoDto = {
        ...baseDto,
        tipo: TipoMovimiento.EGRESO,
        concepto: ConceptoMovimiento.GASTO_GENERAL,
        categoria: CategoriaMovimiento.INSUMOS,
      };

      await service.create(dtoConCategoria);

      expect(movimientoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: CategoriaMovimiento.INSUMOS }),
      );
    });

    it('debe aceptar movimiento sin categoria (campo opcional)', async () => {
      await service.create(baseDto);

      expect(movimientoRepository.create).toHaveBeenCalled();
    });
  });

  describe('findWithFilters - categoria', () => {
    it('debe filtrar movimientos por categoria cuando viene en los filtros', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      movimientoRepository.createQueryBuilder.mockReturnValue(mockQb as never);

      await service.findWithFilters({
        categoria: CategoriaMovimiento.COMIDA,
      } as never);

      const andWhereCalls = mockQb.andWhere.mock.calls.map((c) => c[0]);
      expect(andWhereCalls.some((s: string) => s.includes('categoria'))).toBe(
        true,
      );
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

  describe('crearTransferencia', () => {
    const baseTransferDto = {
      cajaOrigenId: 'caja-origen-uuid',
      cajaDestinoId: 'caja-destino-uuid',
      monto: 500,
      responsableId: 'persona-uuid',
      descripcion: 'Asignacion mensual a Manada',
    };

    const mockEgreso: Partial<Movimiento> = {
      id: 'mov-egreso-uuid',
      cajaId: 'caja-origen-uuid',
      tipo: TipoMovimiento.EGRESO,
      monto: 500,
    };
    const mockIngreso: Partial<Movimiento> = {
      id: 'mov-ingreso-uuid',
      cajaId: 'caja-destino-uuid',
      tipo: TipoMovimiento.INGRESO,
      monto: 500,
    };

    const mockManager = {
      create: jest
        .fn()
        .mockImplementationOnce(() => mockEgreso)
        .mockImplementationOnce(() => mockIngreso),
      save: jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(mockEgreso))
        .mockImplementationOnce(() => Promise.resolve(mockIngreso)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    beforeEach(() => {
      mockManager.create.mockClear();
      mockManager.save.mockClear();
      mockManager.update.mockClear();
      mockManager.create
        .mockImplementationOnce(() => mockEgreso)
        .mockImplementationOnce(() => mockIngreso);
      mockManager.save
        .mockImplementationOnce(() => Promise.resolve(mockEgreso))
        .mockImplementationOnce(() => Promise.resolve(mockIngreso));

      (dataSource.transaction as unknown as jest.Mock).mockImplementation(
        async (cb: (m: unknown) => Promise<unknown>) => cb(mockManager),
      );

      jest.spyOn(service, 'calcularSaldo').mockResolvedValue(10000);

      cajasService.findOne
        .mockResolvedValueOnce({ id: 'caja-origen-uuid' } as never)
        .mockResolvedValueOnce({ id: 'caja-destino-uuid' } as never);
    });

    it('happy path: crea egreso + ingreso linkeados por movimientoRelacionadoId', async () => {
      const result = await service.crearTransferencia(baseTransferDto);

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockManager.create).toHaveBeenCalledTimes(2);
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      expect(mockManager.update).toHaveBeenCalledTimes(2);

      expect(result).toEqual(
        expect.objectContaining({
          egreso: expect.objectContaining({ id: 'mov-egreso-uuid' }),
          ingreso: expect.objectContaining({ id: 'mov-ingreso-uuid' }),
        }),
      );
    });

    it('setea concepto TRANSFERENCIA_ENTRE_CAJAS en ambos movimientos', async () => {
      await service.crearTransferencia(baseTransferDto);

      const egresoPayload = mockManager.create.mock.calls[0][1];
      const ingresoPayload = mockManager.create.mock.calls[1][1];

      expect(egresoPayload).toEqual(
        expect.objectContaining({
          tipo: TipoMovimiento.EGRESO,
          concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
          cajaId: 'caja-origen-uuid',
          responsableId: 'persona-uuid',
          registradoPorId: 'persona-uuid',
        }),
      );
      expect(ingresoPayload).toEqual(
        expect.objectContaining({
          tipo: TipoMovimiento.INGRESO,
          concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
          cajaId: 'caja-destino-uuid',
          responsableId: 'persona-uuid',
          registradoPorId: 'persona-uuid',
        }),
      );
    });

    it('rechaza cuando cajaOrigenId === cajaDestinoId', async () => {
      cajasService.findOne.mockReset();

      await expect(
        service.crearTransferencia({
          ...baseTransferDto,
          cajaDestinoId: baseTransferDto.cajaOrigenId,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rechaza cuando monto <= 0', async () => {
      cajasService.findOne.mockReset();

      await expect(
        service.crearTransferencia({ ...baseTransferDto, monto: 0 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('propaga NotFoundException cuando caja origen no existe', async () => {
      cajasService.findOne.mockReset();
      cajasService.findOne.mockRejectedValueOnce(new NotFoundException());

      await expect(
        service.crearTransferencia(baseTransferDto),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('propaga NotFoundException cuando caja destino no existe', async () => {
      cajasService.findOne.mockReset();
      cajasService.findOne
        .mockResolvedValueOnce({ id: 'caja-origen-uuid' } as never)
        .mockRejectedValueOnce(new NotFoundException());

      await expect(
        service.crearTransferencia(baseTransferDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('propaga NotFoundException cuando responsable no existe', async () => {
      personasService.findOne.mockRejectedValueOnce(new NotFoundException());

      await expect(
        service.crearTransferencia(baseTransferDto),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rechaza con BadRequestException cuando saldo origen es insuficiente', async () => {
      jest.spyOn(service, 'calcularSaldo').mockResolvedValue(100);

      await expect(
        service.crearTransferencia({ ...baseTransferDto, monto: 500 }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('si la transaccion falla, no retorna movimientos parciales (rollback)', async () => {
      dataSource.transaction.mockRejectedValueOnce(new Error('DB failure'));

      await expect(service.crearTransferencia(baseTransferDto)).rejects.toThrow(
        'DB failure',
      );
    });
  });
});
