import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { VentasEventoService } from './ventas-evento.service';
import { EventosService } from '../eventos.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { VentaProducto } from '../entities/venta-producto.entity';
import { Evento } from '../entities/evento.entity';
import { TipoEvento, DestinoGanancia } from '../../../common/enums';
import { VENTAS_ERROR_MESSAGES } from '../constants';

describe('VentasEventoService', () => {
  let service: VentasEventoService;
  let ventaProductoRepository: jest.Mocked<Repository<VentaProducto>>;
  let eventosService: jest.Mocked<EventosService>;
  let movimientosService: jest.Mocked<MovimientosService>;

  const eventoId = 'evento-uuid';
  const ventaId = 'venta-uuid';
  const movimientoId = 'movimiento-uuid';

  const eventoAbierto: Partial<Evento> = {
    id: eventoId,
    nombre: 'Venta empanadas',
    tipo: TipoEvento.VENTA,
    destinoGanancia: DestinoGanancia.CAJA_GRUPO,
    estaCerrado: false,
  };

  const eventoCerrado: Partial<Evento> = {
    ...eventoAbierto,
    estaCerrado: true,
  };

  const ventaConMovimiento: Partial<VentaProducto> = {
    id: ventaId,
    eventoId,
    productoId: 'producto-uuid',
    vendedorId: 'vendedor-uuid',
    cantidad: 3,
    movimientoId,
    deletedAt: null,
  };

  const ventaSinMovimiento: Partial<VentaProducto> = {
    ...ventaConMovimiento,
    movimientoId: null,
  };

  // ----- Fake EntityManager that runs the cascade in-memory -----

  const buildFakeManager = (
    siblings: VentaProducto[] = [],
  ): jest.Mocked<Pick<EntityManager, 'softRemove' | 'createQueryBuilder'>> => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(siblings),
    };
    return {
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    } as unknown as jest.Mocked<
      Pick<EntityManager, 'softRemove' | 'createQueryBuilder'>
    >;
  };

  let fakeManager: ReturnType<typeof buildFakeManager>;

  beforeEach(async () => {
    fakeManager = buildFakeManager();

    const mockVentaRepo = {
      findOne: jest.fn(),
    };

    const mockEventosService = {
      findOne: jest.fn(),
      assertEventoModificable: jest.fn(),
    };

    const mockMovimientosService = {
      softRemoveWithManager: jest.fn().mockResolvedValue(undefined),
    };

    const mockDataSource = {
      transaction: jest.fn(
        async (cb: (m: typeof fakeManager) => unknown) => cb(fakeManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VentasEventoService,
        { provide: getRepositoryToken(VentaProducto), useValue: mockVentaRepo },
        { provide: EventosService, useValue: mockEventosService },
        { provide: MovimientosService, useValue: mockMovimientosService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(VentasEventoService);
    ventaProductoRepository = module.get(getRepositoryToken(VentaProducto));
    eventosService = module.get(EventosService);
    movimientosService = module.get(MovimientosService);
  });

  describe('deleteVenta', () => {
    it('throws NotFoundException when the venta does not exist', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      ventaProductoRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteVenta(eventoId, ventaId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the venta belongs to a different evento', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      ventaProductoRepository.findOne.mockResolvedValue({
        ...ventaConMovimiento,
        eventoId: 'otro-evento',
      } as VentaProducto);

      await expect(service.deleteVenta(eventoId, ventaId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the venta was already soft-deleted', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      ventaProductoRepository.findOne.mockResolvedValue({
        ...ventaConMovimiento,
        deletedAt: new Date(),
      } as VentaProducto);

      await expect(service.deleteVenta(eventoId, ventaId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('propagates BadRequestException when the evento is closed', async () => {
      eventosService.findOne.mockResolvedValue(eventoCerrado as Evento);
      eventosService.assertEventoModificable.mockImplementation(() => {
        throw new BadRequestException('cerrado');
      });

      await expect(service.deleteVenta(eventoId, ventaId)).rejects.toThrow(
        BadRequestException,
      );
      expect(ventaProductoRepository.findOne).not.toHaveBeenCalled();
    });

    it('soft-removes only the venta when it has no associated movimiento', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      ventaProductoRepository.findOne.mockResolvedValue(
        ventaSinMovimiento as VentaProducto,
      );

      const result = await service.deleteVenta(eventoId, ventaId);

      expect(fakeManager.softRemove).toHaveBeenCalledTimes(1);
      expect(fakeManager.softRemove).toHaveBeenCalledWith(ventaSinMovimiento);
      expect(movimientosService.softRemoveWithManager).not.toHaveBeenCalled();
      expect(result).toEqual({
        ventaId,
        movimientoIdEliminado: null,
        hermanasEliminadas: 0,
      });
    });

    it('cascades to the movimiento when the venta has no live siblings', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      ventaProductoRepository.findOne.mockResolvedValue(
        ventaConMovimiento as VentaProducto,
      );

      const result = await service.deleteVenta(eventoId, ventaId);

      expect(fakeManager.softRemove).toHaveBeenCalledWith([ventaConMovimiento]);
      expect(movimientosService.softRemoveWithManager).toHaveBeenCalledWith(
        fakeManager,
        movimientoId,
      );
      expect(result).toEqual({
        ventaId,
        movimientoIdEliminado: movimientoId,
        hermanasEliminadas: 0,
      });
    });

    it('cascades to siblings + movimiento when the venta is part of a lote', async () => {
      const sibling1 = {
        ...ventaConMovimiento,
        id: 'sibling-1',
      } as VentaProducto;
      const sibling2 = {
        ...ventaConMovimiento,
        id: 'sibling-2',
      } as VentaProducto;

      fakeManager = buildFakeManager([sibling1, sibling2]);
      // re-wire DataSource.transaction to use the new fakeManager
      (service as unknown as { dataSource: DataSource }).dataSource = {
        transaction: (cb: (m: unknown) => unknown) => cb(fakeManager),
      } as unknown as DataSource;

      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      ventaProductoRepository.findOne.mockResolvedValue(
        ventaConMovimiento as VentaProducto,
      );

      const result = await service.deleteVenta(eventoId, ventaId);

      expect(fakeManager.softRemove).toHaveBeenCalledWith([
        ventaConMovimiento,
        sibling1,
        sibling2,
      ]);
      expect(movimientosService.softRemoveWithManager).toHaveBeenCalledWith(
        fakeManager,
        movimientoId,
      );
      expect(result).toEqual({
        ventaId,
        movimientoIdEliminado: movimientoId,
        hermanasEliminadas: 2,
      });
    });

    it('uses VENTAS_ERROR_MESSAGES.VENTA_NOT_FOUND on the not-found path', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      ventaProductoRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteVenta(eventoId, ventaId)).rejects.toThrow(
        VENTAS_ERROR_MESSAGES.VENTA_NOT_FOUND(ventaId),
      );
    });
  });
});
