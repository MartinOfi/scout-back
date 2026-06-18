import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeletionValidatorService } from './deletion-validator.service';
import { Movimiento } from '../../modules/movimientos/entities/movimiento.entity';
import { VentaProducto } from '../../modules/eventos/entities/venta-producto.entity';
import { ConceptoMovimiento } from '../enums';

describe('DeletionValidatorService', () => {
  let service: DeletionValidatorService;
  let movimientoRepository: jest.Mocked<Repository<Movimiento>>;
  let ventaProductoRepository: jest.Mocked<Repository<VentaProducto>>;

  // Query builder used by canDeleteEvento. Tests can stub `getCount` per case.
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
  };

  beforeEach(async () => {
    const mockMovimientoRepository = {
      count: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };
    const mockVentaProductoRepository = {
      count: jest.fn(),
    };
    mockQueryBuilder.getCount.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletionValidatorService,
        {
          provide: getRepositoryToken(Movimiento),
          useValue: mockMovimientoRepository,
        },
        {
          provide: getRepositoryToken(VentaProducto),
          useValue: mockVentaProductoRepository,
        },
      ],
    }).compile();

    service = module.get<DeletionValidatorService>(DeletionValidatorService);
    movimientoRepository = module.get(getRepositoryToken(Movimiento));
    ventaProductoRepository = module.get(getRepositoryToken(VentaProducto));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('canDeletePersona', () => {
    it('should return canDelete=true when persona has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeletePersona('persona-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledTimes(2);
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { responsableId: 'persona-uuid' },
      });
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { personaAReembolsarId: 'persona-uuid' },
      });
    });

    it('should return canDelete=false when persona is responsable of movements', async () => {
      movimientoRepository.count
        .mockResolvedValueOnce(3) // as responsable
        .mockResolvedValueOnce(0); // as personaAReembolsar

      const result = await service.canDeletePersona('persona-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('responsable de 3 movimiento(s)');
      expect(result.movementCount).toBe(3);
    });

    it('should return canDelete=false when persona has reimbursements', async () => {
      movimientoRepository.count
        .mockResolvedValueOnce(0) // as responsable
        .mockResolvedValueOnce(2); // as personaAReembolsar

      const result = await service.canDeletePersona('persona-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('2 reembolso(s) registrado(s)');
      expect(result.movementCount).toBe(2);
    });

    it('should check responsable first and stop if found', async () => {
      movimientoRepository.count.mockResolvedValueOnce(5);

      const result = await service.canDeletePersona('persona-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.movementCount).toBe(5);
      // Should only call count once since first check fails
      expect(movimientoRepository.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('canDeleteInscripcion', () => {
    it('should return canDelete=true when inscripcion has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteInscripcion('inscripcion-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { inscripcionId: 'inscripcion-uuid' },
      });
    });

    it('should return canDelete=false when inscripcion has movements', async () => {
      movimientoRepository.count.mockResolvedValue(2);

      const result = await service.canDeleteInscripcion('inscripcion-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('inscripción tiene 2 movimiento(s)');
      expect(result.movementCount).toBe(2);
    });
  });

  describe('canDeleteCuota', () => {
    it('should return canDelete=true when cuota has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteCuota('cuota-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { cuotaId: 'cuota-uuid' },
      });
    });

    it('should return canDelete=false when cuota has movements', async () => {
      movimientoRepository.count.mockResolvedValue(4);

      const result = await service.canDeleteCuota('cuota-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('cuota tiene 4 movimiento(s)');
      expect(result.movementCount).toBe(4);
    });
  });

  describe('canDeleteCampamento', () => {
    it('should return canDelete=true when campamento has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteCampamento('campamento-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { campamentoId: 'campamento-uuid' },
      });
    });

    it('should return canDelete=false when campamento has movements', async () => {
      movimientoRepository.count.mockResolvedValue(10);

      const result = await service.canDeleteCampamento('campamento-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('campamento tiene 10 movimiento(s)');
      expect(result.movementCount).toBe(10);
    });
  });

  describe('canDeleteEvento', () => {
    it('should return canDelete=true when evento has no external movements', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);

      const result = await service.canDeleteEvento('evento-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'm.evento_id = :eventoId',
        { eventoId: 'evento-uuid' },
      );
    });

    it('should return canDelete=false when evento has external movements', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(7);

      const result = await service.canDeleteEvento('evento-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain(
        'evento tiene 7 movimiento(s) externo(s) a ventas',
      );
      expect(result.movementCount).toBe(7);
    });
  });

  describe('canDeleteCaja', () => {
    it('should return canDelete=true when caja has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteCaja('caja-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { cajaId: 'caja-uuid' },
      });
    });

    it('should return canDelete=false when caja has movements', async () => {
      movimientoRepository.count.mockResolvedValue(15);

      const result = await service.canDeleteCaja('caja-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('caja tiene 15 movimiento(s)');
      expect(result.movementCount).toBe(15);
    });
  });

  describe('canDeleteMovimiento', () => {
    it('should return canDelete=true when movimiento does not exist', async () => {
      movimientoRepository.findOne.mockResolvedValue(null);

      const result = await service.canDeleteMovimiento('nonexistent-uuid');

      expect(result.canDelete).toBe(true);
      expect(ventaProductoRepository.count).not.toHaveBeenCalled();
    });

    it('should return canDelete=true for a free movimiento (gasto general, no venta)', async () => {
      movimientoRepository.findOne.mockResolvedValue({
        id: 'mov-uuid',
        concepto: ConceptoMovimiento.GASTO_GENERAL,
        movimientoRelacionadoId: null,
      } as Movimiento);
      ventaProductoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteMovimiento('mov-uuid');

      expect(result.canDelete).toBe(true);
    });

    describe('escenario 1: pertenece a una venta', () => {
      it('should block when a live venta references the movimiento', async () => {
        movimientoRepository.findOne.mockResolvedValue({
          id: 'mov-uuid',
          concepto: ConceptoMovimiento.EVENTO_VENTA_INGRESO,
          movimientoRelacionadoId: null,
        } as Movimiento);
        ventaProductoRepository.count.mockResolvedValue(1);

        const result = await service.canDeleteMovimiento('mov-uuid');

        expect(result.canDelete).toBe(false);
        expect(result.reason).toContain('pertenece a una venta');
        expect(result.movementCount).toBe(1);
        expect(ventaProductoRepository.count).toHaveBeenCalledWith({
          where: [
            { movimientoId: 'mov-uuid' },
            { movimientoRecuperoId: 'mov-uuid' },
          ],
        });
      });

      it('should block when a live venta references the movimiento as recupero (movimientoRecuperoId)', async () => {
        movimientoRepository.findOne.mockResolvedValue({
          id: 'mov-recupero-uuid',
          concepto: ConceptoMovimiento.EVENTO_VENTA_RECUPERO_COSTO,
          movimientoRelacionadoId: null,
        } as Movimiento);
        ventaProductoRepository.count.mockResolvedValue(1);

        const result = await service.canDeleteMovimiento('mov-recupero-uuid');

        expect(result.canDelete).toBe(false);
        expect(result.reason).toContain('pertenece a una venta');
        expect(ventaProductoRepository.count).toHaveBeenCalledWith({
          where: [
            { movimientoId: 'mov-recupero-uuid' },
            { movimientoRecuperoId: 'mov-recupero-uuid' },
          ],
        });
      });

      it('should allow when no live venta references the movimiento', async () => {
        movimientoRepository.findOne.mockResolvedValue({
          id: 'mov-uuid',
          concepto: ConceptoMovimiento.EVENTO_VENTA_INGRESO,
          movimientoRelacionadoId: null,
        } as Movimiento);
        ventaProductoRepository.count.mockResolvedValue(0);

        const result = await service.canDeleteMovimiento('mov-uuid');

        expect(result.canDelete).toBe(true);
      });
    });

    describe('escenario 2: par vinculado (transferencia o pago mixto)', () => {
      it.each([
        ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
        ConceptoMovimiento.USO_SALDO_PERSONAL,
        ConceptoMovimiento.TRANSFERENCIA_SALDO_PERSONAL,
      ])(
        'should block for concepto %s when sibling is alive',
        async (concepto) => {
          movimientoRepository.findOne
            .mockResolvedValueOnce({
              id: 'mov-uuid',
              concepto,
              movimientoRelacionadoId: 'sibling-uuid',
            } as Movimiento)
            .mockResolvedValueOnce({ id: 'sibling-uuid' } as Movimiento);

          const result = await service.canDeleteMovimiento('mov-uuid');

          expect(result.canDelete).toBe(false);
          expect(result.reason).toContain('operación compuesta');
        },
      );

      it('should allow when sibling is already soft-deleted', async () => {
        movimientoRepository.findOne
          .mockResolvedValueOnce({
            id: 'mov-uuid',
            concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
            movimientoRelacionadoId: 'sibling-uuid',
          } as Movimiento)
          .mockResolvedValueOnce(null); // sibling not found (soft-deleted)
        ventaProductoRepository.count.mockResolvedValue(0);

        const result = await service.canDeleteMovimiento('mov-uuid');

        expect(result.canDelete).toBe(true);
      });

      it('should allow for linked-pair concepto when movimientoRelacionadoId is null', async () => {
        movimientoRepository.findOne.mockResolvedValue({
          id: 'mov-uuid',
          concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
          movimientoRelacionadoId: null,
        } as Movimiento);
        ventaProductoRepository.count.mockResolvedValue(0);

        const result = await service.canDeleteMovimiento('mov-uuid');

        expect(result.canDelete).toBe(true);
      });
    });

    describe('escenario 3: pago de campamento', () => {
      it('should block for CAMPAMENTO_PAGO without hitting venta table', async () => {
        movimientoRepository.findOne.mockResolvedValue({
          id: 'mov-uuid',
          concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
          movimientoRelacionadoId: null,
        } as Movimiento);

        const result = await service.canDeleteMovimiento('mov-uuid');

        expect(result.canDelete).toBe(false);
        expect(result.reason).toContain('pago de campamento');
        expect(ventaProductoRepository.count).not.toHaveBeenCalled();
      });
    });

    describe('escenario 4: pago de inscripción o cuota', () => {
      it.each([
        ConceptoMovimiento.INSCRIPCION_GRUPO,
        ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA,
        ConceptoMovimiento.INSCRIPCION_PAGO_SCOUT_ARGENTINA,
        ConceptoMovimiento.CUOTA_GRUPO,
      ])(
        'should block for concepto %s without hitting venta table',
        async (concepto) => {
          movimientoRepository.findOne.mockResolvedValue({
            id: 'mov-uuid',
            concepto,
            movimientoRelacionadoId: null,
          } as Movimiento);

          const result = await service.canDeleteMovimiento('mov-uuid');

          expect(result.canDelete).toBe(false);
          expect(result.reason).toContain('inscripción o cuota');
          expect(ventaProductoRepository.count).not.toHaveBeenCalled();
        },
      );
    });
  });
});
