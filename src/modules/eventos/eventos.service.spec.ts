import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EventosService } from './eventos.service';
import { Evento } from './entities/evento.entity';
import { Producto } from './entities/producto.entity';
import { VentaProducto } from './entities/venta-producto.entity';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import {
  TipoEvento,
  DestinoGanancia,
  CajaType,
  TipoMovimiento,
  ConceptoMovimiento,
  EstadoPago,
  MedioPago,
} from '../../common/enums';
import { Persona } from '../personas/entities/persona.entity';
import { Caja } from '../cajas/entities/caja.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';

describe('EventosService', () => {
  let service: EventosService;
  let eventoRepository: jest.Mocked<Repository<Evento>>;
  let productoRepository: jest.Mocked<Repository<Producto>>;
  let ventaProductoRepository: jest.Mocked<Repository<VentaProducto>>;
  let personasService: jest.Mocked<PersonasService>;
  let cajasService: jest.Mocked<CajasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;
  let fakeManager: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    softRemove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const mockPersona: Partial<Persona> = {
    id: 'persona-uuid',
    nombre: 'Juan Scout',
  };

  const mockEvento: Partial<Evento> = {
    id: 'evento-uuid',
    nombre: 'Venta de Empanadas',
    tipo: TipoEvento.VENTA,
    destinoGanancia: DestinoGanancia.CUENTAS_PERSONALES,
    fecha: new Date('2024-06-15'),
    productos: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockEventoGrupo: Partial<Evento> = {
    id: 'evento-grupo-uuid',
    nombre: 'Campamento Anual',
    tipo: TipoEvento.GRUPO,
    destinoGanancia: DestinoGanancia.CAJA_GRUPO,
    fecha: new Date('2024-07-01'),
    productos: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockProducto: Partial<Producto> = {
    id: 'producto-uuid',
    eventoId: 'evento-uuid',
    nombre: 'Empanada de Carne',
    precioCosto: 500,
    precioVenta: 1000,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockVenta: Partial<VentaProducto> = {
    id: 'venta-uuid',
    eventoId: 'evento-uuid',
    productoId: 'producto-uuid',
    vendedorId: 'persona-uuid',
    cantidad: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCajaGrupo: Partial<Caja> = {
    id: 'caja-grupo-uuid',
    tipo: CajaType.GRUPO,
  };

  beforeEach(async () => {
    const mockEventoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockProductoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockVentaProductoRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockPersonasService = {
      findOne: jest.fn().mockResolvedValue(mockPersona),
    };

    const mockCajasService = {
      findCajaGrupo: jest.fn().mockResolvedValue(mockCajaGrupo),
      getOrCreateCajaPersonal: jest.fn(),
    };

    const mockMovimientosService = {
      create: jest.fn(),
      createWithManager: jest.fn().mockResolvedValue({ id: 'movimiento-uuid' }),
      softRemoveWithManager: jest.fn().mockResolvedValue(undefined),
      findByRelatedEntity: jest.fn(),
    };

    const mockDeletionValidator = {
      canDeleteEvento: jest.fn().mockResolvedValue({ canDelete: true }),
    };

    /**
     * In-memory DataSource mock that runs the transaction callback
     * synchronously against a fake EntityManager. The fake manager
     * supports the calls EventosService makes inside its transactions:
     *   - create / save (registrarVenta + Lote)
     *   - find (cascade removal of ventas/productos)
     *   - softRemove (cascade)
     *   - createQueryBuilder (cascade of venta-derived movimientos)
     */
    fakeManager = {
      create: jest.fn((_entity: unknown, payload: unknown) => payload),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockDataSource = {
      transaction: jest.fn(async (cb: (m: typeof fakeManager) => unknown) =>
        cb(fakeManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventosService,
        {
          provide: getRepositoryToken(Evento),
          useValue: mockEventoRepository,
        },
        {
          provide: getRepositoryToken(Producto),
          useValue: mockProductoRepository,
        },
        {
          provide: getRepositoryToken(VentaProducto),
          useValue: mockVentaProductoRepository,
        },
        {
          provide: PersonasService,
          useValue: mockPersonasService,
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
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<EventosService>(EventosService);
    eventoRepository = module.get(getRepositoryToken(Evento));
    productoRepository = module.get(getRepositoryToken(Producto));
    ventaProductoRepository = module.get(getRepositoryToken(VentaProducto));
    personasService = module.get(PersonasService);
    cajasService = module.get(CajasService);
    movimientosService = module.get(MovimientosService);
    deletionValidator = module.get(DeletionValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return an evento when found', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);

      const result = await service.findOne('evento-uuid');

      expect(result).toEqual(mockEvento);
      expect(eventoRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'evento-uuid' },
        relations: ['productos'],
      });
    });

    it('should throw NotFoundException when evento not found', async () => {
      eventoRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove (Evento)', () => {
    describe('validation', () => {
      it('should throw NotFoundException when evento does not exist', async () => {
        eventoRepository.findOne.mockResolvedValue(null);

        await expect(service.remove('non-existent-id')).rejects.toThrow(
          NotFoundException,
        );
        expect(deletionValidator.canDeleteEvento).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when evento has movements', async () => {
        eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: false,
          reason: 'No se puede eliminar: el evento tiene 5 movimiento(s)',
          movementCount: 5,
        });

        await expect(service.remove('evento-uuid')).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.remove('evento-uuid')).rejects.toThrow(
          /evento tiene 5 movimiento/,
        );
        expect(eventoRepository.softRemove).not.toHaveBeenCalled();
      });
    });

    describe('cascade deletion', () => {
      it('should soft remove evento without cascade when no productos/ventas exist', async () => {
        eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: true,
        });
        fakeManager.find.mockResolvedValue([]);

        await service.remove('evento-uuid');

        expect(deletionValidator.canDeleteEvento).toHaveBeenCalledWith(
          'evento-uuid',
        );
        // Only the evento itself was soft-removed (no cascade rows existed).
        expect(fakeManager.softRemove).toHaveBeenCalledTimes(1);
        expect(fakeManager.softRemove).toHaveBeenCalledWith(mockEvento);
      });

      it('should cascade delete ventas and productos when removing evento', async () => {
        const ventas = [mockVenta as VentaProducto];
        const productos = [mockProducto as Producto];

        eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: true,
        });
        fakeManager.find.mockImplementation(async (entity: unknown) => {
          if (entity === VentaProducto) return ventas;
          if (entity === Producto) return productos;
          return [];
        });

        await service.remove('evento-uuid');

        // Manager should have soft-removed the ventas list, the productos list,
        // and the evento itself (3 calls).
        expect(fakeManager.softRemove).toHaveBeenCalledWith(ventas);
        expect(fakeManager.softRemove).toHaveBeenCalledWith(productos);
        expect(fakeManager.softRemove).toHaveBeenCalledWith(mockEvento);
      });

      it('should delete movimientos, ventas, productos, then evento (correct order)', async () => {
        const callOrder: string[] = [];
        const ventas = [mockVenta as VentaProducto];
        const productos = [mockProducto as Producto];
        const movimientos = [{ id: 'mov-uuid' }];

        eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: true,
        });

        // movimientos cascade goes through createQueryBuilder
        fakeManager.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue(movimientos),
        });

        fakeManager.find.mockImplementation(async (entity: unknown) => {
          if (entity === VentaProducto) return ventas;
          if (entity === Producto) return productos;
          return [];
        });

        fakeManager.softRemove.mockImplementation(async (arg: unknown) => {
          if (arg === movimientos) callOrder.push('movimientos');
          else if (arg === ventas) callOrder.push('ventas');
          else if (arg === productos) callOrder.push('productos');
          else callOrder.push('evento');
          return undefined;
        });

        await service.remove('evento-uuid');

        expect(callOrder).toEqual([
          'movimientos',
          'ventas',
          'productos',
          'evento',
        ]);
      });
    });
  });

  describe('removeProducto', () => {
    describe('validation', () => {
      it('should throw NotFoundException when producto does not exist', async () => {
        productoRepository.findOne.mockResolvedValue(null);

        await expect(service.removeProducto('non-existent-id')).rejects.toThrow(
          NotFoundException,
        );
        expect(deletionValidator.canDeleteEvento).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when parent evento has movements', async () => {
        productoRepository.findOne.mockResolvedValue(mockProducto as Producto);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: false,
          reason: 'No se puede eliminar: el evento tiene 3 movimiento(s)',
          movementCount: 3,
        });

        await expect(service.removeProducto('producto-uuid')).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.removeProducto('producto-uuid')).rejects.toThrow(
          /evento tiene movimientos asociados/,
        );
        expect(productoRepository.softRemove).not.toHaveBeenCalled();
      });
    });

    describe('cascade deletion', () => {
      it('should soft remove producto without cascade when no ventas exist', async () => {
        productoRepository.findOne.mockResolvedValue(mockProducto as Producto);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: true,
        });
        ventaProductoRepository.find.mockResolvedValue([]);
        productoRepository.softRemove.mockResolvedValue(
          mockProducto as Producto,
        );

        await service.removeProducto('producto-uuid');

        expect(deletionValidator.canDeleteEvento).toHaveBeenCalledWith(
          'evento-uuid',
        );
        expect(ventaProductoRepository.softRemove).not.toHaveBeenCalled();
        expect(productoRepository.softRemove).toHaveBeenCalledWith(
          mockProducto,
        );
      });

      it('should cascade delete ventas when removing producto', async () => {
        const ventas = [mockVenta as VentaProducto];

        productoRepository.findOne.mockResolvedValue(mockProducto as Producto);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: true,
        });
        ventaProductoRepository.find.mockResolvedValue(ventas);
        ventaProductoRepository.softRemove.mockResolvedValue(
          ventas as unknown as VentaProducto,
        );
        productoRepository.softRemove.mockResolvedValue(
          mockProducto as Producto,
        );

        await service.removeProducto('producto-uuid');

        expect(ventaProductoRepository.find).toHaveBeenCalledWith({
          where: { productoId: 'producto-uuid' },
        });
        expect(ventaProductoRepository.softRemove).toHaveBeenCalledWith(ventas);
        expect(productoRepository.softRemove).toHaveBeenCalledWith(
          mockProducto,
        );
      });
    });
  });

  describe('create', () => {
    it('should create an evento', async () => {
      const dto = {
        nombre: 'Nuevo Evento',
        tipo: TipoEvento.VENTA,
        destinoGanancia: DestinoGanancia.CUENTAS_PERSONALES,
        fecha: new Date('2024-08-01'),
      };

      const created = { ...dto, id: 'new-uuid', productos: [] };

      eventoRepository.create.mockReturnValue(created as unknown as Evento);
      eventoRepository.save.mockResolvedValue(created as unknown as Evento);

      const result = await service.create(dto);

      expect(eventoRepository.create).toHaveBeenCalledWith(dto);
      expect(result.nombre).toBe('Nuevo Evento');
      expect(result.tipo).toBe(TipoEvento.VENTA);
    });
  });

  describe('createProducto', () => {
    it('should create a producto for an existing evento', async () => {
      const dto = {
        eventoId: 'evento-uuid',
        nombre: 'Nueva Empanada',
        precioCosto: 600,
        precioVenta: 1200,
      };

      const created = { ...dto, id: 'new-producto-uuid' };

      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.create.mockReturnValue(created as Producto);
      productoRepository.save.mockResolvedValue(created as Producto);

      const result = await service.createProducto(dto);

      expect(eventoRepository.findOne).toHaveBeenCalled(); // Validates evento exists
      expect(productoRepository.create).toHaveBeenCalledWith(dto);
      expect(result.nombre).toBe('Nueva Empanada');
    });

    it('should throw NotFoundException when evento does not exist', async () => {
      eventoRepository.findOne.mockResolvedValue(null);

      const dto = {
        eventoId: 'non-existent-evento',
        nombre: 'Empanada',
        precioCosto: 500,
        precioVenta: 1000,
      };

      await expect(service.createProducto(dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('registrarVenta', () => {
    it('should register a sale', async () => {
      const dto = {
        eventoId: 'evento-uuid',
        productoId: 'producto-uuid',
        vendedorId: 'persona-uuid',
        cantidad: 5,
        medioPago: MedioPago.EFECTIVO,
      };

      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.findOne.mockResolvedValue(mockProducto as Producto);
      // Stub the personal caja so the in-tx movimiento creation has an id.
      (cajasService.getOrCreateCajaPersonal as jest.Mock).mockResolvedValue({
        id: 'caja-personal-uuid',
      });

      const result = await service.registrarVenta(dto);

      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
      // The venta is created via the fake EntityManager inside the transaction.
      expect(fakeManager.create).toHaveBeenCalled();
      expect(fakeManager.save).toHaveBeenCalled();
      expect(result.cantidad).toBe(5);
    });

    it('should throw NotFoundException when producto does not exist', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.findOne.mockResolvedValue(null);

      const dto = {
        eventoId: 'evento-uuid',
        productoId: 'non-existent-producto',
        vendedorId: 'persona-uuid',
        cantidad: 5,
        medioPago: MedioPago.EFECTIVO,
      };

      await expect(service.registrarVenta(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when producto belongs to different evento', async () => {
      const productoOtroEvento = {
        ...mockProducto,
        eventoId: 'otro-evento-uuid',
      };

      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.findOne.mockResolvedValue(
        productoOtroEvento as Producto,
      );

      const dto = {
        eventoId: 'evento-uuid',
        productoId: 'producto-uuid',
        vendedorId: 'persona-uuid',
        cantidad: 5,
        medioPago: MedioPago.EFECTIVO,
      };

      await expect(service.registrarVenta(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.registrarVenta(dto)).rejects.toThrow(
        /no pertenece a este evento/,
      );
    });
  });

  describe('registrarVentasLote', () => {
    const mockProducto2: Partial<Producto> = {
      id: 'producto-2-uuid',
      eventoId: 'evento-uuid',
      nombre: 'Empanada de Verdura',
      precioCosto: 400,
      precioVenta: 800,
    };

    it('should register multiple ventas for a single vendedor in one call', async () => {
      const dto = {
        vendedorId: 'persona-uuid',
        medioPago: MedioPago.EFECTIVO,
        items: [
          { productoId: 'producto-uuid', cantidad: 5 },
          { productoId: 'producto-2-uuid', cantidad: 3 },
        ],
      };

      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([
        mockProducto as Producto,
        mockProducto2 as Producto,
      ]);
      (cajasService.getOrCreateCajaPersonal as jest.Mock).mockResolvedValue({
        id: 'caja-personal-uuid',
      });
      // The fakeManager.save returns whatever it receives, so to count items
      // we hand it back an array of two ventas after the bulk save.
      fakeManager.save.mockImplementationOnce(async () => [
        {
          ...dto.items[0],
          eventoId: 'evento-uuid',
          vendedorId: 'persona-uuid',
        },
        {
          ...dto.items[1],
          eventoId: 'evento-uuid',
          vendedorId: 'persona-uuid',
        },
      ]);

      const result = await service.registrarVentasLote('evento-uuid', dto);

      expect(personasService.findOne).toHaveBeenCalledTimes(1);
      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
      expect(eventoRepository.findOne).toHaveBeenCalledTimes(1);
      // The transaction creates 2 venta entities via the manager.
      expect(fakeManager.create).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException when evento does not exist', async () => {
      eventoRepository.findOne.mockResolvedValue(null);

      await expect(
        service.registrarVentasLote('non-existent-id', {
          vendedorId: 'persona-uuid',
          items: [{ productoId: 'producto-uuid', cantidad: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when a producto does not belong to the evento', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([mockProducto as Producto]);

      await expect(
        service.registrarVentasLote('evento-uuid', {
          vendedorId: 'persona-uuid',
          items: [{ productoId: 'producto-de-otro-evento', cantidad: 2 }],
        }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.registrarVentasLote('evento-uuid', {
          vendedorId: 'persona-uuid',
          items: [{ productoId: 'producto-de-otro-evento', cantidad: 2 }],
        }),
      ).rejects.toThrow(/no encontrado en este evento/);
    });

    it('should throw NotFoundException when vendedor does not exist', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      personasService.findOne.mockRejectedValue(
        new NotFoundException('Persona no encontrada'),
      );

      await expect(
        service.registrarVentasLote('evento-uuid', {
          vendedorId: 'non-existent-vendedor',
          items: [{ productoId: 'producto-uuid', cantidad: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should bulk save all ventas in a single manager call', async () => {
      const dto = {
        vendedorId: 'persona-uuid',
        medioPago: MedioPago.EFECTIVO,
        items: [
          { productoId: 'producto-uuid', cantidad: 10 },
          { productoId: 'producto-2-uuid', cantidad: 7 },
        ],
      };

      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([
        mockProducto as Producto,
        mockProducto2 as Producto,
      ]);
      (cajasService.getOrCreateCajaPersonal as jest.Mock).mockResolvedValue({
        id: 'caja-personal-uuid',
      });
      // First save = bulk array of ventas, returns empty list (we don't care
      // about the response shape here, only that the bulk call happened).
      fakeManager.save.mockImplementationOnce(async () => []);

      await service.registrarVentasLote('evento-uuid', dto);

      // The first save() must have received an array of 2 venta payloads
      // — one bulk insert, not two separate calls.
      const firstCallArg = fakeManager.save.mock.calls[0]?.[0];
      expect(Array.isArray(firstCallArg)).toBe(true);
      expect((firstCallArg as unknown[]).length).toBe(2);
    });
  });

  describe('findAll', () => {
    it('should return all eventos ordered by fecha DESC', async () => {
      eventoRepository.find.mockResolvedValue([mockEvento as Evento]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(eventoRepository.find).toHaveBeenCalledWith({
        relations: ['productos'],
        order: { fecha: 'DESC' },
      });
    });
  });

  describe('findProductosByEvento', () => {
    it('should return productos for an evento', async () => {
      productoRepository.find.mockResolvedValue([mockProducto as Producto]);

      const result = await service.findProductosByEvento('evento-uuid');

      expect(result).toHaveLength(1);
      expect(productoRepository.find).toHaveBeenCalledWith({
        where: { eventoId: 'evento-uuid' },
        order: { nombre: 'ASC' },
      });
    });
  });

  describe('findProductosConVentas', () => {
    it('should return productos with cantidadVendida summed across all ventas', async () => {
      const mockVenta2: Partial<VentaProducto> = {
        ...mockVenta,
        id: 'venta-uuid-2',
        cantidad: 5,
      };

      productoRepository.find.mockResolvedValue([mockProducto as Producto]);
      ventaProductoRepository.find.mockResolvedValue([
        mockVenta as VentaProducto,
        mockVenta2 as VentaProducto,
      ]);

      const result = await service.findProductosConVentas('evento-uuid');

      expect(result).toHaveLength(1);
      expect(result[0].cantidadVendida).toBe(15); // 10 + 5
    });

    it('should return cantidadVendida = 0 when no ventas exist', async () => {
      productoRepository.find.mockResolvedValue([mockProducto as Producto]);
      ventaProductoRepository.find.mockResolvedValue([]);

      const result = await service.findProductosConVentas('evento-uuid');

      expect(result[0].cantidadVendida).toBe(0);
    });

    it('should not count ventas from other productos', async () => {
      const otroProducto: Partial<Producto> = {
        ...mockProducto,
        id: 'otro-producto-uuid',
        nombre: 'Empanada de Verdura',
      };
      const ventaOtroProducto: Partial<VentaProducto> = {
        ...mockVenta,
        productoId: 'otro-producto-uuid',
        cantidad: 99,
      };

      productoRepository.find.mockResolvedValue([
        mockProducto as Producto,
        otroProducto as Producto,
      ]);
      ventaProductoRepository.find.mockResolvedValue([
        mockVenta as VentaProducto,
        ventaOtroProducto as VentaProducto,
      ]);

      const result = await service.findProductosConVentas('evento-uuid');
      const empanaCarne = result.find((p) => p.id === 'producto-uuid')!;
      const empanaVerdura = result.find((p) => p.id === 'otro-producto-uuid')!;

      expect(empanaCarne.cantidadVendida).toBe(10);
      expect(empanaVerdura.cantidadVendida).toBe(99);
    });
  });

  describe('findVentasByEvento', () => {
    /**
     * Creates a chainable query builder stub that records every call so
     * tests can assert the assembled query (joins, where clauses, order
     * by, parameters) without standing up a real database.
     */
    function createQbStub(returnRows: VentaProducto[]) {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(returnRows),
      };
      return qb;
    }

    it('should join producto+vendedor and order by date / vendedor / producto', async () => {
      const qb = createQbStub([mockVenta as VentaProducto]);
      ventaProductoRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<
          typeof ventaProductoRepository.createQueryBuilder
        >,
      );

      const result = await service.findVentasByEvento('evento-uuid');

      expect(result).toHaveLength(1);
      expect(ventaProductoRepository.createQueryBuilder).toHaveBeenCalledWith(
        'venta',
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'venta.producto',
        'producto',
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'venta.vendedor',
        'vendedor',
      );
      expect(qb.where).toHaveBeenCalledWith('venta.eventoId = :eventoId', {
        eventoId: 'evento-uuid',
      });
      expect(qb.orderBy).toHaveBeenCalledWith(
        expect.stringContaining('AT TIME ZONE :tz'),
        'DESC',
      );
      expect(qb.addOrderBy).toHaveBeenCalledWith('vendedor.nombre', 'ASC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('producto.nombre', 'ASC');
      expect(qb.setParameter).toHaveBeenCalledWith(
        'tz',
        'America/Argentina/Buenos_Aires',
      );
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should NOT add an ILIKE filter when vendedor is undefined', async () => {
      const qb = createQbStub([]);
      ventaProductoRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<
          typeof ventaProductoRepository.createQueryBuilder
        >,
      );

      await service.findVentasByEvento('evento-uuid');

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should NOT add an ILIKE filter when vendedor is whitespace-only', async () => {
      const qb = createQbStub([]);
      ventaProductoRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<
          typeof ventaProductoRepository.createQueryBuilder
        >,
      );

      await service.findVentasByEvento('evento-uuid', '   ');

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should add ILIKE filter wrapped in % wildcards when vendedor is provided', async () => {
      const qb = createQbStub([]);
      ventaProductoRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<
          typeof ventaProductoRepository.createQueryBuilder
        >,
      );

      await service.findVentasByEvento('evento-uuid', 'mar');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'vendedor.nombre ILIKE :nombre',
        { nombre: '%mar%' },
      );
    });

    it('should escape LIKE special characters to prevent wildcard bypass', async () => {
      const qb = createQbStub([]);
      ventaProductoRepository.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<
          typeof ventaProductoRepository.createQueryBuilder
        >,
      );

      await service.findVentasByEvento('evento-uuid', '%_\\');

      expect(qb.andWhere).toHaveBeenCalledWith(
        'vendedor.nombre ILIKE :nombre',
        { nombre: '%\\%\\_\\\\%' },
      );
    });
  });

  describe('getKpisEvento', () => {
    const mockIngreso = {
      id: 'mov-ingreso-uuid',
      tipo: TipoMovimiento.INGRESO,
      concepto: ConceptoMovimiento.EVENTO_GRUPO_INGRESO,
      monto: 15000,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PAGADO,
      fecha: new Date('2026-01-10'),
    };

    const mockGastoPagado = {
      id: 'mov-gasto-pagado-uuid',
      tipo: TipoMovimiento.EGRESO,
      concepto: ConceptoMovimiento.EVENTO_GRUPO_GASTO,
      monto: 4000,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PAGADO,
      fecha: new Date('2026-01-11'),
    };

    const mockGastoPendiente = {
      id: 'mov-gasto-pendiente-uuid',
      tipo: TipoMovimiento.EGRESO,
      concepto: ConceptoMovimiento.EVENTO_GRUPO_GASTO,
      monto: 2500,
      medioPago: MedioPago.EFECTIVO,
      estadoPago: EstadoPago.PENDIENTE_REEMBOLSO,
      fecha: new Date('2026-01-12'),
    };

    it('should discriminate egresos by estadoPago into totalGastado and totalPendienteReembolso', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEventoGrupo as Evento);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockIngreso,
        mockGastoPagado,
        mockGastoPendiente,
      ] as unknown as Movimiento[]);
      // KPI calc reads ventas + productos to compute totalRecaudado.
      // Grupo events have neither, so empty arrays are correct.
      ventaProductoRepository.find.mockResolvedValue([]);
      productoRepository.find.mockResolvedValue([]);

      const result = await service.getKpisEvento('evento-grupo-uuid');

      // gananciaVentas now sums INGRESO movimientos (used to be totalIngresos).
      expect(result.gananciaVentas).toBe(15000);
      expect(result.totalGastado).toBe(4000);
      expect(result.totalPendienteReembolso).toBe(2500);
      expect(result.balance).toBe(15000 - 4000); // 11000
    });

    it('should not count PENDIENTE_REEMBOLSO egresos in balance', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEventoGrupo as Evento);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockIngreso, // 15000 ingreso
        mockGastoPendiente, // 2500 pendiente (should NOT affect balance)
      ] as unknown as Movimiento[]);
      ventaProductoRepository.find.mockResolvedValue([]);
      productoRepository.find.mockResolvedValue([]);

      const result = await service.getKpisEvento('evento-grupo-uuid');

      expect(result.balance).toBe(15000); // Pending does not reduce balance
      expect(result.totalGastado).toBe(0);
      expect(result.totalPendienteReembolso).toBe(2500);
    });

    it('should return zeros when evento has no movements', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEventoGrupo as Evento);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);
      ventaProductoRepository.find.mockResolvedValue([]);
      productoRepository.find.mockResolvedValue([]);

      const result = await service.getKpisEvento('evento-grupo-uuid');

      expect(result.gananciaVentas).toBe(0);
      expect(result.totalGastado).toBe(0);
      expect(result.totalPendienteReembolso).toBe(0);
      expect(result.balance).toBe(0);
    });

    it('should throw NotFoundException when evento does not exist', async () => {
      eventoRepository.findOne.mockResolvedValue(null);

      await expect(service.getKpisEvento('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getResumenVentas', () => {
    const mockProducto2: Partial<Producto> = {
      id: 'producto-2-uuid',
      eventoId: 'evento-uuid',
      nombre: 'Empanada de Verdura',
      precioCosto: 400,
      precioVenta: 800,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const mockVendedor2Id = 'persona-2-uuid';

    const makeVenta = (
      overrides: Partial<VentaProducto> & { vendedor: Partial<Persona> },
    ): VentaProducto =>
      ({
        ...mockVenta,
        ...overrides,
      }) as VentaProducto;

    it('should include desglose per product for each vendedor', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([
        mockProducto as Producto,
        mockProducto2 as Producto,
      ]);
      // vendedor 1 sold 10 of producto1, 5 of producto2
      ventaProductoRepository.find.mockResolvedValue([
        makeVenta({
          productoId: 'producto-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 10,
          vendedor: { id: 'persona-uuid', nombre: 'Juan Scout' } as Persona,
          producto: mockProducto as Producto,
        }),
        makeVenta({
          id: 'venta-2-uuid',
          productoId: 'producto-2-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 5,
          vendedor: { id: 'persona-uuid', nombre: 'Juan Scout' } as Persona,
          producto: mockProducto2 as Producto,
        }),
      ]);

      const result = await service.getResumenVentas('evento-uuid');

      const vendedor = result.ventasPorVendedor[0];
      expect(vendedor.desglose).toHaveLength(2);

      const desgloseProducto1 = vendedor.desglose.find(
        (d) => d.productoId === 'producto-uuid',
      )!;
      expect(desgloseProducto1.cantidad).toBe(10);
      expect(desgloseProducto1.ganancia).toBe(5000); // (1000-500)*10

      const desgloseProducto2 = vendedor.desglose.find(
        (d) => d.productoId === 'producto-2-uuid',
      )!;
      expect(desgloseProducto2.cantidad).toBe(5);
      expect(desgloseProducto2.ganancia).toBe(2000); // (800-400)*5
    });

    it('should aggregate desglose across multiple ventas of the same product', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([mockProducto as Producto]);
      ventaProductoRepository.find.mockResolvedValue([
        makeVenta({
          productoId: 'producto-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 4,
          vendedor: { id: 'persona-uuid', nombre: 'Juan Scout' } as Persona,
          producto: mockProducto as Producto,
        }),
        makeVenta({
          id: 'venta-2-uuid',
          productoId: 'producto-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 6,
          vendedor: { id: 'persona-uuid', nombre: 'Juan Scout' } as Persona,
          producto: mockProducto as Producto,
        }),
      ]);

      const result = await service.getResumenVentas('evento-uuid');

      const vendedor = result.ventasPorVendedor[0];
      expect(vendedor.desglose).toHaveLength(1);
      expect(vendedor.desglose[0].cantidad).toBe(10);
      expect(vendedor.desglose[0].ganancia).toBe(5000); // (1000-500)*10
    });

    it('should keep desgloses separate per vendedor', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([mockProducto as Producto]);
      ventaProductoRepository.find.mockResolvedValue([
        makeVenta({
          productoId: 'producto-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 3,
          vendedor: { id: 'persona-uuid', nombre: 'Juan Scout' } as Persona,
          producto: mockProducto as Producto,
        }),
        makeVenta({
          id: 'venta-v2-uuid',
          productoId: 'producto-uuid',
          vendedorId: mockVendedor2Id,
          cantidad: 7,
          vendedor: {
            id: mockVendedor2Id,
            nombre: 'María Scout',
          } as Persona,
          producto: mockProducto as Producto,
        }),
      ]);

      const result = await service.getResumenVentas('evento-uuid');

      const v1 = result.ventasPorVendedor.find(
        (v) => v.vendedorId === 'persona-uuid',
      )!;
      const v2 = result.ventasPorVendedor.find(
        (v) => v.vendedorId === mockVendedor2Id,
      )!;

      expect(v1.desglose[0].cantidad).toBe(3);
      expect(v2.desglose[0].cantidad).toBe(7);
    });

    it('should return empty desglose when no ventas exist', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([mockProducto as Producto]);
      ventaProductoRepository.find.mockResolvedValue([]);

      const result = await service.getResumenVentas('evento-uuid');

      expect(result.ventasPorVendedor).toHaveLength(0);
      expect(result.gananciaTotal).toBe(0);
    });

    it('should filter ventasPorVendedor by nombre (case-insensitive partial match)', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([mockProducto as Producto]);
      ventaProductoRepository.find.mockResolvedValue([
        makeVenta({
          productoId: 'producto-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 3,
          vendedor: { id: 'persona-uuid', nombre: 'Juan Scout' } as Persona,
          producto: mockProducto as Producto,
        }),
        makeVenta({
          id: 'venta-v2-uuid',
          productoId: 'producto-uuid',
          vendedorId: mockVendedor2Id,
          cantidad: 7,
          vendedor: { id: mockVendedor2Id, nombre: 'María Scout' } as Persona,
          producto: mockProducto as Producto,
        }),
      ]);

      const result = await service.getResumenVentas('evento-uuid', 'juan');

      expect(result.ventasPorVendedor).toHaveLength(1);
      expect(result.ventasPorVendedor[0].vendedorNombre).toBe('Juan Scout');
    });

    it('should return all vendedores when no filter is provided', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.find.mockResolvedValue([mockProducto as Producto]);
      ventaProductoRepository.find.mockResolvedValue([
        makeVenta({
          productoId: 'producto-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 3,
          vendedor: { id: 'persona-uuid', nombre: 'Juan Scout' } as Persona,
          producto: mockProducto as Producto,
        }),
        makeVenta({
          id: 'venta-v2-uuid',
          productoId: 'producto-uuid',
          vendedorId: mockVendedor2Id,
          cantidad: 7,
          vendedor: { id: mockVendedor2Id, nombre: 'María Scout' } as Persona,
          producto: mockProducto as Producto,
        }),
      ]);

      const result = await service.getResumenVentas('evento-uuid');

      expect(result.ventasPorVendedor).toHaveLength(2);
    });
  });

  describe('registrarGastoEvento', () => {
    it('should throw BadRequestException for non-grupo event on registrarIngresoEventoGrupo', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento); // tipo VENTA

      await expect(
        service.registrarIngresoEventoGrupo(
          'evento-uuid',
          1000,
          'Donación',
          'persona-uuid',
          MedioPago.EFECTIVO,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.registrarIngresoEventoGrupo(
          'evento-uuid',
          1000,
          'Donación',
          'persona-uuid',
          MedioPago.EFECTIVO,
        ),
      ).rejects.toThrow(/solo para eventos de grupo/);
    });
  });
});
