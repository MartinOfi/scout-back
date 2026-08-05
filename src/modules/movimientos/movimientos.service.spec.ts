import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { MovimientosService } from './movimientos.service';
import { Movimiento } from './entities/movimiento.entity';
import { CajasService } from '../cajas/cajas.service';
import { PersonasService } from '../personas/personas.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
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
  let deletionValidator: jest.Mocked<DeletionValidatorService>;

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

    const mockDeletionValidator = {
      canDeleteMovimiento: jest.fn().mockResolvedValue({ canDelete: true }),
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
        {
          provide: DeletionValidatorService,
          useValue: mockDeletionValidator,
        },
      ],
    }).compile();

    service = module.get<MovimientosService>(MovimientosService);
    movimientoRepository = module.get(getRepositoryToken(Movimiento));
    cajasService = module.get(CajasService);
    personasService = module.get(PersonasService);
    dataSource = module.get(DataSource);
    deletionValidator = module.get(DeletionValidatorService);
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
      });

      const andWhereCalls = mockQb.andWhere.mock.calls.map((c) => c[0]);
      expect(andWhereCalls.some((s: string) => s.includes('categoria'))).toBe(
        true,
      );
    });
  });

  describe('calcularSaldo', () => {
    function mockQueryBuilder(saldo: string | null) {
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ saldo }),
      };
      movimientoRepository.createQueryBuilder.mockReturnValue(mockQb as any);
      return mockQb;
    }

    it('returns the saldo as a number', async () => {
      mockQueryBuilder('1234.56');

      const result = await service.calcularSaldo('caja-uuid');

      expect(result).toBe(1234.56);
    });

    it('returns 0 when the caja has no movimientos', async () => {
      mockQueryBuilder(null);

      const result = await service.calcularSaldo('caja-uuid');

      expect(result).toBe(0);
    });

    it('filters by cajaId and non-deleted movimientos', async () => {
      const mockQb = mockQueryBuilder('0');

      await service.calcularSaldo('caja-uuid');

      expect(mockQb.where).toHaveBeenCalledWith('m.caja_id = :cajaId', {
        cajaId: 'caja-uuid',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('m.deletedAt IS NULL');
    });

    // Regresión F2: un ingreso pendiente_cobro o un egreso pendiente_reembolso
    // no deben sumar/restar al saldo. La regla vive en la expresión SQL
    // (SALDO_SUM_EXPRESSION), no en JS, así que lo que este test protege es
    // que la cláusula CASE que efectivamente viaja a Postgres siga excluyendo
    // ambos estados — si alguien la revierte, este test lo detecta acá en vez
    // de en producción.
    it('excluye pendiente_cobro y pendiente_reembolso en la expresión SQL', async () => {
      const mockQb = mockQueryBuilder('0');

      await service.calcularSaldo('caja-uuid');

      const sqlExpression = mockQb.select.mock.calls[0][0] as string;
      expect(sqlExpression).toContain(':pendienteCobro');
      expect(sqlExpression).toContain(':pendienteReembolso');

      const params = mockQb.setParameters.mock.calls[0][0];
      expect(params.pendienteCobro).toBe(EstadoPago.PENDIENTE_COBRO);
      expect(params.pendienteReembolso).toBe(EstadoPago.PENDIENTE_REEMBOLSO);
    });
  });

  describe('calcularSaldoPersona', () => {
    it('delega en calcularSaldo con la caja personal', async () => {
      const spy = jest.spyOn(service, 'calcularSaldo').mockResolvedValue(500);

      const result = await service.calcularSaldoPersona('caja-personal-uuid');

      expect(spy).toHaveBeenCalledWith('caja-personal-uuid');
      expect(result).toBe(500);
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
        setParameters: jest.fn().mockReturnThis(),
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

    it('setea concepto TRANSFERENCIA_ENTRE_CAJAS y medioPago EFECTIVO por default', async () => {
      await service.crearTransferencia(baseTransferDto);

      const egresoPayload = mockManager.create.mock.calls[0][1];
      const ingresoPayload = mockManager.create.mock.calls[1][1];

      expect(egresoPayload).toEqual(
        expect.objectContaining({
          tipo: TipoMovimiento.EGRESO,
          concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
          medioPago: MedioPago.EFECTIVO,
          cajaId: 'caja-origen-uuid',
          responsableId: 'persona-uuid',
          registradoPorId: 'persona-uuid',
        }),
      );
      expect(ingresoPayload).toEqual(
        expect.objectContaining({
          tipo: TipoMovimiento.INGRESO,
          concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
          medioPago: MedioPago.EFECTIVO,
          cajaId: 'caja-destino-uuid',
          responsableId: 'persona-uuid',
          registradoPorId: 'persona-uuid',
        }),
      );
    });

    it('acepta un concepto explicito (override) y lo aplica a ambos movimientos', async () => {
      await service.crearTransferencia(
        baseTransferDto,
        ConceptoMovimiento.TRANSFERENCIA_SALDO_PERSONAL,
      );

      const egresoPayload = mockManager.create.mock.calls[0][1];
      const ingresoPayload = mockManager.create.mock.calls[1][1];

      expect(egresoPayload).toEqual(
        expect.objectContaining({
          concepto: ConceptoMovimiento.TRANSFERENCIA_SALDO_PERSONAL,
          medioPago: MedioPago.EFECTIVO,
        }),
      );
      expect(ingresoPayload).toEqual(
        expect.objectContaining({
          concepto: ConceptoMovimiento.TRANSFERENCIA_SALDO_PERSONAL,
          medioPago: MedioPago.EFECTIVO,
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

  describe('remove', () => {
    const mockMovimientoNormal: Partial<Movimiento> = {
      id: 'mov-uuid',
      cajaId: 'caja-uuid',
      tipo: TipoMovimiento.INGRESO,
      monto: 1000,
      concepto: ConceptoMovimiento.CUOTA_GRUPO,
      movimientoRelacionadoId: null,
    };

    it('elimina un movimiento normal delegando en el validador de borrado', async () => {
      movimientoRepository.findOne.mockResolvedValue(
        mockMovimientoNormal as Movimiento,
      );

      await service.remove('mov-uuid');

      expect(deletionValidator.canDeleteMovimiento).toHaveBeenCalledWith(
        'mov-uuid',
      );
      expect(movimientoRepository.softRemove).toHaveBeenCalledWith(
        mockMovimientoNormal,
      );
    });

    it('rechaza con BadRequestException cuando el validador bloquea el borrado', async () => {
      movimientoRepository.findOne.mockResolvedValue(
        mockMovimientoNormal as Movimiento,
      );
      deletionValidator.canDeleteMovimiento.mockResolvedValueOnce({
        canDelete: false,
        reason: 'bloqueado',
      });

      await expect(service.remove('mov-uuid')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(movimientoRepository.softRemove).not.toHaveBeenCalled();
    });

    describe('transferencia entre cajas (par egreso/ingreso)', () => {
      const mockEgresoTransferencia: Partial<Movimiento> = {
        id: 'mov-egreso-uuid',
        cajaId: 'caja-origen-uuid',
        tipo: TipoMovimiento.EGRESO,
        monto: 500,
        concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
        movimientoRelacionadoId: 'mov-ingreso-uuid',
      };
      const mockIngresoTransferencia: Partial<Movimiento> = {
        id: 'mov-ingreso-uuid',
        cajaId: 'caja-destino-uuid',
        tipo: TipoMovimiento.INGRESO,
        monto: 500,
        concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
        movimientoRelacionadoId: 'mov-egreso-uuid',
      };

      let mockManager: { softRemove: jest.Mock };

      beforeEach(() => {
        mockManager = { softRemove: jest.fn().mockResolvedValue(undefined) };
        (dataSource.transaction as unknown as jest.Mock).mockImplementation(
          async (cb: (m: unknown) => Promise<unknown>) => cb(mockManager),
        );
        jest.spyOn(service, 'calcularSaldo').mockResolvedValue(500);
      });

      it('elimina el par egreso+ingreso atomicamente sin pasar por el validador generico', async () => {
        movimientoRepository.findOne
          .mockResolvedValueOnce(mockEgresoTransferencia as Movimiento) // findOne(id)
          .mockResolvedValueOnce(mockIngresoTransferencia as Movimiento); // sibling lookup

        await service.remove('mov-egreso-uuid');

        expect(deletionValidator.canDeleteMovimiento).not.toHaveBeenCalled();
        expect(dataSource.transaction).toHaveBeenCalled();
        expect(mockManager.softRemove).toHaveBeenCalledWith(
          mockEgresoTransferencia,
        );
        expect(mockManager.softRemove).toHaveBeenCalledWith(
          mockIngresoTransferencia,
        );
        expect(mockManager.softRemove).toHaveBeenCalledTimes(2);
      });

      it('funciona igual si se llama remove() sobre el lado ingreso del par', async () => {
        movimientoRepository.findOne
          .mockResolvedValueOnce(mockIngresoTransferencia as Movimiento)
          .mockResolvedValueOnce(mockEgresoTransferencia as Movimiento);

        await service.remove('mov-ingreso-uuid');

        expect(mockManager.softRemove).toHaveBeenCalledTimes(2);
      });

      it('rechaza con BadRequestException si la caja destino ya no tiene fondos suficientes', async () => {
        movimientoRepository.findOne
          .mockResolvedValueOnce(mockEgresoTransferencia as Movimiento)
          .mockResolvedValueOnce(mockIngresoTransferencia as Movimiento);
        jest.spyOn(service, 'calcularSaldo').mockResolvedValue(100);

        await expect(service.remove('mov-egreso-uuid')).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(dataSource.transaction).not.toHaveBeenCalled();
      });

      it('si el sibling ya fue borrado (soft-deleted), elimina solo el movimiento restante', async () => {
        movimientoRepository.findOne
          .mockResolvedValueOnce(mockEgresoTransferencia as Movimiento)
          .mockResolvedValueOnce(null);

        await service.remove('mov-egreso-uuid');

        expect(mockManager.softRemove).toHaveBeenCalledTimes(1);
        expect(mockManager.softRemove).toHaveBeenCalledWith(
          mockEgresoTransferencia,
        );
      });
    });
  });
});
