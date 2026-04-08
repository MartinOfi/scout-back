import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

describe('EventosService', () => {
  let service: EventosService;
  let eventoRepository: jest.Mocked<Repository<Evento>>;
  let productoRepository: jest.Mocked<Repository<Producto>>;
  let ventaProductoRepository: jest.Mocked<Repository<VentaProducto>>;
  let personasService: jest.Mocked<PersonasService>;
  let cajasService: jest.Mocked<CajasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;

  const mockPersona: Partial<Persona> = {
    id: 'persona-uuid',
    nombre: 'Juan Scout',
  };

  const mockEvento: Partial<Evento> = {
    id: 'evento-uuid',
    nombre: 'Venta de Empanadas',
    tipo: TipoEvento.VENTA,
    destinoGanancia: DestinoGanancia.CUENTA_PERSONAL,
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
      findByRelatedEntity: jest.fn(),
    };

    const mockDeletionValidator = {
      canDeleteEvento: jest.fn().mockResolvedValue({ canDelete: true }),
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
        ventaProductoRepository.find.mockResolvedValue([]);
        productoRepository.find.mockResolvedValue([]);
        eventoRepository.softRemove.mockResolvedValue(mockEvento as Evento);

        await service.remove('evento-uuid');

        expect(deletionValidator.canDeleteEvento).toHaveBeenCalledWith(
          'evento-uuid',
        );
        expect(ventaProductoRepository.softRemove).not.toHaveBeenCalled();
        expect(productoRepository.softRemove).not.toHaveBeenCalled();
        expect(eventoRepository.softRemove).toHaveBeenCalledWith(mockEvento);
      });

      it('should cascade delete ventas and productos when removing evento', async () => {
        const ventas = [mockVenta as VentaProducto];
        const productos = [mockProducto as Producto];

        eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: true,
        });
        ventaProductoRepository.find.mockResolvedValue(ventas);
        productoRepository.find.mockResolvedValue(productos);
        ventaProductoRepository.softRemove.mockResolvedValue(ventas);
        productoRepository.softRemove.mockResolvedValue(productos);
        eventoRepository.softRemove.mockResolvedValue(mockEvento as Evento);

        await service.remove('evento-uuid');

        expect(ventaProductoRepository.find).toHaveBeenCalledWith({
          where: { eventoId: 'evento-uuid' },
        });
        expect(ventaProductoRepository.softRemove).toHaveBeenCalledWith(ventas);
        expect(productoRepository.find).toHaveBeenCalledWith({
          where: { eventoId: 'evento-uuid' },
        });
        expect(productoRepository.softRemove).toHaveBeenCalledWith(productos);
        expect(eventoRepository.softRemove).toHaveBeenCalledWith(mockEvento);
      });

      it('should delete ventas first, then productos, then evento (correct order)', async () => {
        const callOrder: string[] = [];

        eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
        deletionValidator.canDeleteEvento.mockResolvedValue({
          canDelete: true,
        });
        ventaProductoRepository.find.mockResolvedValue([
          mockVenta as VentaProducto,
        ]);
        productoRepository.find.mockResolvedValue([mockProducto as Producto]);

        ventaProductoRepository.softRemove.mockImplementation(async () => {
          callOrder.push('ventas');
          return [mockVenta as VentaProducto];
        });
        productoRepository.softRemove.mockImplementation(async () => {
          callOrder.push('productos');
          return [mockProducto as Producto];
        });
        eventoRepository.softRemove.mockImplementation(async () => {
          callOrder.push('evento');
          return mockEvento as Evento;
        });

        await service.remove('evento-uuid');

        expect(callOrder).toEqual(['ventas', 'productos', 'evento']);
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
        ventaProductoRepository.softRemove.mockResolvedValue(ventas);
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
        destinoGanancia: DestinoGanancia.CUENTA_PERSONAL,
        fecha: new Date('2024-08-01'),
      };

      const created = { ...dto, id: 'new-uuid', productos: [] };

      eventoRepository.create.mockReturnValue(created as Evento);
      eventoRepository.save.mockResolvedValue(created as Evento);

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
      };

      const created = { ...dto, id: 'new-venta-uuid' };

      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento);
      productoRepository.findOne.mockResolvedValue(mockProducto as Producto);
      ventaProductoRepository.create.mockReturnValue(created as VentaProducto);
      ventaProductoRepository.save.mockResolvedValue(created as VentaProducto);

      const result = await service.registrarVenta(dto);

      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
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
      ventaProductoRepository.create.mockImplementation(
        (data) => data as VentaProducto,
      );
      ventaProductoRepository.save.mockResolvedValue([
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
      ] as VentaProducto[]);

      const result = await service.registrarVentasLote('evento-uuid', dto);

      expect(personasService.findOne).toHaveBeenCalledTimes(1);
      expect(personasService.findOne).toHaveBeenCalledWith('persona-uuid');
      expect(eventoRepository.findOne).toHaveBeenCalledTimes(1);
      expect(ventaProductoRepository.create).toHaveBeenCalledTimes(2);
      expect(ventaProductoRepository.save).toHaveBeenCalledTimes(1);
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

    it('should bulk save all ventas in a single repository call', async () => {
      const dto = {
        vendedorId: 'persona-uuid',
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
      ventaProductoRepository.create.mockImplementation(
        (data) => data as VentaProducto,
      );
      ventaProductoRepository.save.mockResolvedValue([] as VentaProducto[]);

      await service.registrarVentasLote('evento-uuid', dto);

      expect(ventaProductoRepository.save).toHaveBeenCalledWith([
        {
          eventoId: 'evento-uuid',
          productoId: 'producto-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 10,
        },
        {
          eventoId: 'evento-uuid',
          productoId: 'producto-2-uuid',
          vendedorId: 'persona-uuid',
          cantidad: 7,
        },
      ]);
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

  describe('findVentasByEvento', () => {
    it('should return ventas for an evento with relations', async () => {
      ventaProductoRepository.find.mockResolvedValue([
        mockVenta as VentaProducto,
      ]);

      const result = await service.findVentasByEvento('evento-uuid');

      expect(result).toHaveLength(1);
      expect(ventaProductoRepository.find).toHaveBeenCalledWith({
        where: { eventoId: 'evento-uuid' },
        relations: ['producto', 'vendedor'],
        order: { createdAt: 'DESC' },
      });
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

    it('should discriminate egresos by estadoPago into totalGastadoEfectivo and totalPendienteReembolso', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEventoGrupo as Evento);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockIngreso,
        mockGastoPagado,
        mockGastoPendiente,
      ] as any);

      const result = await service.getKpisEvento('evento-grupo-uuid');

      expect(result.totalIngresos).toBe(15000);
      expect(result.totalGastadoEfectivo).toBe(4000);
      expect(result.totalPendienteReembolso).toBe(2500);
      expect(result.balance).toBe(15000 - 4000); // 11000
    });

    it('should not count PENDIENTE_REEMBOLSO egresos in balance', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEventoGrupo as Evento);
      movimientosService.findByRelatedEntity.mockResolvedValue([
        mockIngreso, // 15000 ingreso
        mockGastoPendiente, // 2500 pendiente (should NOT affect balance)
      ] as any);

      const result = await service.getKpisEvento('evento-grupo-uuid');

      expect(result.balance).toBe(15000); // Pending does not reduce balance
      expect(result.totalGastadoEfectivo).toBe(0);
      expect(result.totalPendienteReembolso).toBe(2500);
    });

    it('should return zeros when evento has no movements', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEventoGrupo as Evento);
      movimientosService.findByRelatedEntity.mockResolvedValue([]);

      const result = await service.getKpisEvento('evento-grupo-uuid');

      expect(result.totalIngresos).toBe(0);
      expect(result.totalGastadoEfectivo).toBe(0);
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

  describe('registrarGastoEvento', () => {
    it('should throw BadRequestException for non-grupo event on registrarIngresoEventoGrupo', async () => {
      eventoRepository.findOne.mockResolvedValue(mockEvento as Evento); // tipo VENTA

      await expect(
        service.registrarIngresoEventoGrupo(
          'evento-uuid',
          1000,
          'Donación',
          'persona-uuid',
          'efectivo' as any,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.registrarIngresoEventoGrupo(
          'evento-uuid',
          1000,
          'Donación',
          'persona-uuid',
          'efectivo' as any,
        ),
      ).rejects.toThrow(/solo para eventos de grupo/);
    });
  });
});
