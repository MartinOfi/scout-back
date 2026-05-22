import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EntregasEventoService } from './entregas-evento.service';
import { EventosService } from '../eventos.service';
import { PersonasService } from '../../personas/personas.service';
import { Entrega } from '../entities/entrega.entity';
import { EntregaLinea } from '../entities/entrega-linea.entity';
import { VentaProducto } from '../entities/venta-producto.entity';
import { Producto } from '../entities/producto.entity';
import { Evento } from '../entities/evento.entity';
import { Persona } from '../../personas/entities/persona.entity';
import { TipoEvento, DestinoGanancia } from '../../../common/enums';
import { ENTREGAS_ERROR_MESSAGES } from '../constants';

type QbMock = Record<string, jest.Mock> & {
  getRawMany: jest.Mock;
  getMany: jest.Mock;
};

const makeQb = (): QbMock => {
  const qb: QbMock = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue([]),
  };
  return qb;
};

describe('EntregasEventoService', () => {
  let service: EntregasEventoService;
  let entregaRepository: jest.Mocked<Repository<Entrega>>;
  let entregaLineaRepository: jest.Mocked<Repository<EntregaLinea>>;
  let ventaProductoRepository: jest.Mocked<Repository<VentaProducto>>;
  let productoRepository: jest.Mocked<Repository<Producto>>;
  let personaRepository: jest.Mocked<Repository<Persona>>;
  let eventosService: jest.Mocked<EventosService>;
  let personasService: jest.Mocked<PersonasService>;
  let dataSource: { transaction: jest.Mock; getRepository: jest.Mock };

  const eventoId = 'evento-uuid';
  const vendedorId = 'vendedor-uuid';
  const productoLocroId = 'producto-locro-uuid';
  const productoEmpanadaId = 'producto-empanada-uuid';

  const eventoAbierto: Partial<Evento> = {
    id: eventoId,
    nombre: 'Venta de locros',
    tipo: TipoEvento.VENTA,
    destinoGanancia: DestinoGanancia.CAJA_GRUPO,
    estaCerrado: false,
  };

  const vendedor: Partial<Persona> = {
    id: vendedorId,
    nombre: 'Juan Pérez',
  };

  const productoLocro: Partial<Producto> = {
    id: productoLocroId,
    eventoId,
    nombre: 'Locro',
  };

  const productoEmpanada: Partial<Producto> = {
    id: productoEmpanadaId,
    eventoId,
    nombre: 'Empanada',
  };

  // Per-transaction fake manager. Used by `crearEntrega` and `deleteEntrega`.
  // Sub-tests override `managerQb` getRawMany values to simulate ventas/entregas
  // for the stock totals query.
  let managerVentasQb: QbMock;
  let managerEntregasQb: QbMock;
  let fakeManager: {
    create: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
    find: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  // Productos returned by `manager.find(Producto, ...)` during a tx.
  // setupHappyPath overrides this with the test's evento productos.
  let managerProductosReturn: Producto[] = [];

  const buildFakeManager = () => {
    managerVentasQb = makeQb();
    managerEntregasQb = makeQb();

    // First call → ventas qb, second → entregas qb.
    const qbSequence = [managerVentasQb, managerEntregasQb];

    return {
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        ...payload,
        id: payload.id ?? `generated-${Math.random().toString(36).slice(2)}`,
      })),
      save: jest.fn((arg: unknown) => Promise.resolve(arg)),
      softRemove: jest.fn().mockResolvedValue(undefined),
      // `manager.find(Producto, { where: { eventoId } })` is called from
      // loadProductosOfEventoTx. Return whatever the test set up.
      find: jest
        .fn()
        .mockImplementation(() => Promise.resolve(managerProductosReturn)),
      createQueryBuilder: jest.fn(() => qbSequence.shift() ?? makeQb()),
    };
  };

  beforeEach(async () => {
    managerProductosReturn = [];
    fakeManager = buildFakeManager();

    const mockEntregaRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    };
    const mockEntregaLineaRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    };
    const mockVentaProductoRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
    };
    const mockProductoRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockPersonaRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    const mockEventosService = {
      findOne: jest.fn(),
      assertEventoModificable: jest.fn(),
    };

    const mockPersonasService = {
      findOne: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(async (cb: (m: EntityManager) => unknown) =>
        cb(fakeManager as unknown as EntityManager),
      ),
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntregasEventoService,
        { provide: getRepositoryToken(Entrega), useValue: mockEntregaRepo },
        {
          provide: getRepositoryToken(EntregaLinea),
          useValue: mockEntregaLineaRepo,
        },
        {
          provide: getRepositoryToken(VentaProducto),
          useValue: mockVentaProductoRepo,
        },
        { provide: getRepositoryToken(Producto), useValue: mockProductoRepo },
        { provide: getRepositoryToken(Persona), useValue: mockPersonaRepo },
        { provide: EventosService, useValue: mockEventosService },
        { provide: PersonasService, useValue: mockPersonasService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(EntregasEventoService);
    entregaRepository = module.get(getRepositoryToken(Entrega));
    entregaLineaRepository = module.get(getRepositoryToken(EntregaLinea));
    ventaProductoRepository = module.get(getRepositoryToken(VentaProducto));
    productoRepository = module.get(getRepositoryToken(Producto));
    personaRepository = module.get(getRepositoryToken(Persona));
    eventosService = module.get(EventosService);
    personasService = module.get(PersonasService);
  });

  // ==================== crearEntrega ====================

  describe('crearEntrega', () => {
    const setupHappyPath = (
      ventas: Array<{ productoId: string; cantidadVendida: string }>,
      entregas: Array<{ productoId: string; cantidadEntregada: string }> = [],
    ) => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      personasService.findOne.mockResolvedValue(vendedor as Persona);
      // Productos load now lives inside the tx, served by fakeManager.find.
      managerProductosReturn = [
        productoLocro as Producto,
        productoEmpanada as Producto,
      ];
      managerVentasQb.getRawMany.mockResolvedValue(ventas);
      managerEntregasQb.getRawMany.mockResolvedValue(entregas);
    };

    it('throws BadRequestException when the evento is closed', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      eventosService.assertEventoModificable.mockImplementation(() => {
        throw new BadRequestException('cerrado');
      });

      await expect(
        service.crearEntrega(eventoId, {
          vendedorId,
          items: [{ productoId: productoLocroId, cantidad: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(personasService.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the vendedor does not exist', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      personasService.findOne.mockRejectedValue(
        new NotFoundException('persona'),
      );

      await expect(
        service.crearEntrega(eventoId, {
          vendedorId,
          items: [{ productoId: productoLocroId, cantidad: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when items contain a duplicated productoId', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      personasService.findOne.mockResolvedValue(vendedor as Persona);

      await expect(
        service.crearEntrega(eventoId, {
          vendedorId,
          items: [
            { productoId: productoLocroId, cantidad: 1 },
            { productoId: productoLocroId, cantidad: 2 },
          ],
        }),
      ).rejects.toThrow(ENTREGAS_ERROR_MESSAGES.DUPLICATE_PRODUCTO_IN_ITEMS);
    });

    it('throws BadRequestException when a productoId does not belong to the evento', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      personasService.findOne.mockResolvedValue(vendedor as Persona);
      managerProductosReturn = [productoLocro as Producto];

      await expect(
        service.crearEntrega(eventoId, {
          vendedorId,
          items: [{ productoId: 'producto-de-otro-evento', cantidad: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the vendedor has no ventas of the producto', async () => {
      setupHappyPath([]); // no ventas at all

      await expect(
        service.crearEntrega(eventoId, {
          vendedorId,
          items: [{ productoId: productoLocroId, cantidad: 1 }],
        }),
      ).rejects.toThrow(
        ENTREGAS_ERROR_MESSAGES.VENDEDOR_SIN_VENTAS_DEL_PRODUCTO('Locro'),
      );
    });

    it('throws BadRequestException when stock disponible is insufficient', async () => {
      setupHappyPath(
        [{ productoId: productoLocroId, cantidadVendida: '10' }],
        [{ productoId: productoLocroId, cantidadEntregada: '7' }],
      );

      await expect(
        service.crearEntrega(eventoId, {
          vendedorId,
          items: [{ productoId: productoLocroId, cantidad: 4 }],
        }),
      ).rejects.toThrow(
        ENTREGAS_ERROR_MESSAGES.STOCK_INSUFICIENTE('Locro', 3, 4),
      );
    });

    it('persists header + lines when stock is sufficient', async () => {
      setupHappyPath(
        [
          { productoId: productoLocroId, cantidadVendida: '10' },
          { productoId: productoEmpanadaId, cantidadVendida: '5' },
        ],
        [{ productoId: productoLocroId, cantidadEntregada: '2' }],
      );

      const result = await service.crearEntrega(
        eventoId,
        {
          vendedorId,
          notas: 'Retiró María 18:30',
          items: [
            { productoId: productoLocroId, cantidad: 4 },
            { productoId: productoEmpanadaId, cantidad: 2 },
          ],
        },
        'admin-uuid',
      );

      expect(fakeManager.create).toHaveBeenCalledWith(
        Entrega,
        expect.objectContaining({
          eventoId,
          vendedorId,
          notas: 'Retiró María 18:30',
          registradoPorId: 'admin-uuid',
        }),
      );
      expect(fakeManager.save).toHaveBeenCalled();
      expect(result.vendedorNombre).toBe('Juan Pérez');
      expect(result.lineas).toHaveLength(2);
      expect(result.lineas[0].productoNombre).toBe('Locro');
      expect(result.lineas[1].productoNombre).toBe('Empanada');
    });

    it('allows exact-stock delivery (cantidad == disponible)', async () => {
      setupHappyPath(
        [{ productoId: productoLocroId, cantidadVendida: '10' }],
        [{ productoId: productoLocroId, cantidadEntregada: '7' }],
      );

      await expect(
        service.crearEntrega(eventoId, {
          vendedorId,
          items: [{ productoId: productoLocroId, cantidad: 3 }],
        }),
      ).resolves.toBeDefined();
    });
  });

  // ==================== deleteEntrega ====================

  describe('deleteEntrega', () => {
    const entregaId = 'entrega-uuid';
    const lineaIds = ['linea-1', 'linea-2'];

    const liveEntrega = {
      id: entregaId,
      eventoId,
      vendedorId,
      deletedAt: null,
      lineas: lineaIds.map((id) => ({ id, productoId: productoLocroId })),
    } as unknown as Entrega;

    it('throws NotFoundException when the entrega does not exist', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      entregaRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteEntrega(eventoId, entregaId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the entrega belongs to a different evento', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      entregaRepository.findOne.mockResolvedValue({
        ...liveEntrega,
        eventoId: 'otro-evento',
      } as Entrega);

      await expect(service.deleteEntrega(eventoId, entregaId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the entrega is already soft-deleted', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      entregaRepository.findOne.mockResolvedValue({
        ...liveEntrega,
        deletedAt: new Date(),
      } as Entrega);

      await expect(service.deleteEntrega(eventoId, entregaId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('soft-removes the entrega and its lines in a transaction', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);
      entregaRepository.findOne.mockResolvedValue(liveEntrega);

      await service.deleteEntrega(eventoId, entregaId);

      expect(dataSource.transaction).toHaveBeenCalled();
      // First softRemove: lines. Second: header.
      expect(fakeManager.softRemove).toHaveBeenCalledTimes(2);
      expect(fakeManager.softRemove).toHaveBeenNthCalledWith(
        1,
        liveEntrega.lineas,
      );
      expect(fakeManager.softRemove).toHaveBeenNthCalledWith(2, liveEntrega);
    });
  });

  // ==================== getStockDisponible ====================

  describe('getStockDisponible', () => {
    it('returns vendida/entregada/disponible merged from ventas and entregas', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);

      const ventasQb = makeQb();
      const entregasQb = makeQb();
      (ventaProductoRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        ventasQb,
      );
      (entregaLineaRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        entregasQb,
      );

      ventasQb.getRawMany.mockResolvedValue([
        {
          productoId: productoLocroId,
          vendedorId,
          cantidadVendida: '10',
        },
      ]);
      entregasQb.getRawMany.mockResolvedValue([
        {
          productoId: productoLocroId,
          vendedorId,
          cantidadEntregada: '4',
        },
      ]);

      productoRepository.find.mockResolvedValue([productoLocro as Producto]);
      personaRepository.find.mockResolvedValue([vendedor as Persona]);

      const result = await service.getStockDisponible(eventoId);

      expect(result).toEqual([
        {
          productoId: productoLocroId,
          productoNombre: 'Locro',
          vendedorId,
          vendedorNombre: 'Juan Pérez',
          cantidadVendida: 10,
          cantidadEntregada: 4,
          cantidadDisponible: 6,
        },
      ]);
    });

    it('filters by vendedor name case-insensitively after aggregation', async () => {
      eventosService.findOne.mockResolvedValue(eventoAbierto as Evento);

      const ventasQb = makeQb();
      const entregasQb = makeQb();
      (ventaProductoRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        ventasQb,
      );
      (entregaLineaRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        entregasQb,
      );

      ventasQb.getRawMany.mockResolvedValue([
        {
          productoId: productoLocroId,
          vendedorId,
          cantidadVendida: '10',
        },
        {
          productoId: productoLocroId,
          vendedorId: 'otro-vendedor',
          cantidadVendida: '5',
        },
      ]);
      entregasQb.getRawMany.mockResolvedValue([]);

      productoRepository.find.mockResolvedValue([productoLocro as Producto]);
      personaRepository.find.mockResolvedValue([
        vendedor as Persona,
        { id: 'otro-vendedor', nombre: 'María García' } as Persona,
      ]);

      const result = await service.getStockDisponible(eventoId, 'juan');

      expect(result).toHaveLength(1);
      expect(result[0].vendedorNombre).toBe('Juan Pérez');
    });
  });
});
