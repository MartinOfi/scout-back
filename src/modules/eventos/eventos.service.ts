import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Evento } from './entities/evento.entity';
import { Producto } from './entities/producto.entity';
import { VentaProducto } from './entities/venta-producto.entity';
import { CreateEventoDto } from './dtos/create-evento.dto';
import { UpdateEventoDto } from './dtos/update-evento.dto';
import { CreateProductoDto } from './dtos/create-producto.dto';
import { CreateVentaProductoDto } from './dtos/create-venta-producto.dto';
import { RegisterVentasLoteDto } from './dtos/register-ventas-lote.dto';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import {
  TipoEvento,
  DestinoGanancia,
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
} from '../../common/enums';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';

@Injectable()
export class EventosService {
  constructor(
    @InjectRepository(Evento)
    private readonly eventoRepository: Repository<Evento>,
    @InjectRepository(Producto)
    private readonly productoRepository: Repository<Producto>,
    @InjectRepository(VentaProducto)
    private readonly ventaProductoRepository: Repository<VentaProducto>,
    private readonly personasService: PersonasService,
    private readonly cajasService: CajasService,
    private readonly movimientosService: MovimientosService,
    private readonly deletionValidator: DeletionValidatorService,
  ) {}

  // ==================== EVENTOS ====================

  async findAll(): Promise<Evento[]> {
    return this.eventoRepository.find({
      relations: ['productos'],
      order: { fecha: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Evento> {
    const evento = await this.eventoRepository.findOne({
      where: { id },
      relations: ['productos'],
    });

    if (!evento) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }

    return evento;
  }

  async create(dto: CreateEventoDto): Promise<Evento> {
    const evento = this.eventoRepository.create(dto);
    return this.eventoRepository.save(evento);
  }

  async update(id: string, dto: UpdateEventoDto): Promise<Evento> {
    const evento = await this.findOne(id);
    Object.assign(evento, dto);
    return this.eventoRepository.save(evento);
  }

  /**
   * Soft delete de evento - solo si no tiene movimientos asociados
   *
   * Cascada: Elimina todos los productos y ventas del evento
   */
  async remove(id: string): Promise<void> {
    const evento = await this.findOne(id);

    // Validar que no tenga movimientos asociados
    const check = await this.deletionValidator.canDeleteEvento(id);
    if (!check.canDelete) {
      throw new BadRequestException(check.reason);
    }

    // Cascada: eliminar todas las ventas del evento
    const ventas = await this.ventaProductoRepository.find({
      where: { eventoId: id },
    });
    if (ventas.length > 0) {
      await this.ventaProductoRepository.softRemove(ventas);
    }

    // Cascada: eliminar todos los productos del evento
    const productos = await this.productoRepository.find({
      where: { eventoId: id },
    });
    if (productos.length > 0) {
      await this.productoRepository.softRemove(productos);
    }

    await this.eventoRepository.softRemove(evento);
  }

  // ==================== PRODUCTOS ====================

  async createProducto(dto: CreateProductoDto): Promise<Producto> {
    await this.findOne(dto.eventoId); // Validar que el evento existe

    const producto = this.productoRepository.create(dto);
    return this.productoRepository.save(producto);
  }

  async findProductosByEvento(eventoId: string): Promise<Producto[]> {
    return this.productoRepository.find({
      where: { eventoId },
      order: { nombre: 'ASC' },
    });
  }

  /**
   * Soft delete de producto - solo si el evento no tiene movimientos
   *
   * Cascada: Elimina todas las ventas de este producto
   */
  async removeProducto(id: string): Promise<void> {
    const producto = await this.productoRepository.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    // Validar que el evento no tenga movimientos
    const check = await this.deletionValidator.canDeleteEvento(
      producto.eventoId,
    );
    if (!check.canDelete) {
      throw new BadRequestException(
        'No se puede eliminar: el evento tiene movimientos asociados',
      );
    }

    // Cascada: eliminar ventas de este producto
    const ventas = await this.ventaProductoRepository.find({
      where: { productoId: id },
    });
    if (ventas.length > 0) {
      await this.ventaProductoRepository.softRemove(ventas);
    }

    await this.productoRepository.softRemove(producto);
  }

  // ==================== VENTAS ====================

  async registrarVenta(dto: CreateVentaProductoDto): Promise<VentaProducto> {
    await this.findOne(dto.eventoId); // Validate event exists
    const producto = await this.productoRepository.findOne({
      where: { id: dto.productoId },
    });

    if (!producto) {
      throw new NotFoundException(
        `Producto con ID ${dto.productoId} no encontrado`,
      );
    }

    if (producto.eventoId !== dto.eventoId) {
      throw new BadRequestException('El producto no pertenece a este evento');
    }

    await this.personasService.findOne(dto.vendedorId);

    const venta = this.ventaProductoRepository.create(dto);
    return this.ventaProductoRepository.save(venta);
  }

  async registrarVentasLote(
    eventoId: string,
    dto: RegisterVentasLoteDto,
  ): Promise<VentaProducto[]> {
    await this.findOne(eventoId);
    await this.personasService.findOne(dto.vendedorId);

    const productosEvento = await this.findProductosByEvento(eventoId);
    const productosMap = new Map(productosEvento.map((p) => [p.id, p]));

    for (const item of dto.items) {
      const producto = productosMap.get(item.productoId);
      if (!producto) {
        throw new NotFoundException(
          `Producto con ID ${item.productoId} no encontrado en este evento`,
        );
      }
    }

    const ventasToCreate = dto.items.map((item) =>
      this.ventaProductoRepository.create({
        eventoId,
        productoId: item.productoId,
        vendedorId: dto.vendedorId,
        cantidad: item.cantidad,
      }),
    );

    return this.ventaProductoRepository.save(ventasToCreate);
  }

  async findVentasByEvento(eventoId: string): Promise<VentaProducto[]> {
    return this.ventaProductoRepository.find({
      where: { eventoId },
      relations: ['producto', 'vendedor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findVentasByVendedor(
    eventoId: string,
    vendedorId: string,
  ): Promise<VentaProducto[]> {
    return this.ventaProductoRepository.find({
      where: { eventoId, vendedorId },
      relations: ['producto'],
    });
  }

  // ==================== CIERRE Y DISTRIBUCIÓN ====================

  async cerrarEventoVenta(
    eventoId: string,
    medioPago: MedioPago,
  ): Promise<void> {
    const evento = await this.findOne(eventoId);

    if (evento.tipo !== TipoEvento.VENTA) {
      throw new BadRequestException('Solo se pueden cerrar eventos de venta');
    }

    const ventas = await this.findVentasByEvento(eventoId);
    const productos = await this.findProductosByEvento(eventoId);

    // Calcular ganancia total y por vendedor
    const gananciaPorVendedor = new Map<string, number>();
    let gananciaTotal = 0;

    for (const venta of ventas) {
      const producto = productos.find((p) => p.id === venta.productoId);
      if (!producto) continue;

      const gananciaUnitaria =
        Number(producto.precioVenta) - Number(producto.precioCosto);
      const gananciaVenta = gananciaUnitaria * venta.cantidad;
      gananciaTotal += gananciaVenta;

      const actual = gananciaPorVendedor.get(venta.vendedorId) || 0;
      gananciaPorVendedor.set(venta.vendedorId, actual + gananciaVenta);
    }

    const cajaGrupo = await this.cajasService.findCajaGrupo();

    if (evento.destinoGanancia === DestinoGanancia.CAJA_GRUPO) {
      // Todo va a la caja del grupo
      await this.movimientosService.create({
        cajaId: cajaGrupo.id,
        tipo: TipoMovimiento.INGRESO,
        monto: gananciaTotal,
        concepto: ConceptoMovimiento.EVENTO_VENTA_INGRESO,
        descripcion: `Ganancia evento "${evento.nombre}"`,
        responsableId: Array.from(gananciaPorVendedor.keys())[0] || '',
        medioPago,
        estadoPago: EstadoPago.PAGADO,
        eventoId,
      });
    } else {
      // Distribuir a cuentas personales
      for (const [vendedorId, ganancia] of gananciaPorVendedor) {
        const cajaPersonal =
          await this.cajasService.getOrCreateCajaPersonal(vendedorId);

        await this.movimientosService.create({
          cajaId: cajaPersonal.id,
          tipo: TipoMovimiento.INGRESO,
          monto: ganancia,
          concepto: ConceptoMovimiento.EVENTO_VENTA_INGRESO,
          descripcion: `Ganancia evento "${evento.nombre}"`,
          responsableId: vendedorId,
          medioPago,
          estadoPago: EstadoPago.PAGADO,
          eventoId,
        });
      }
    }
  }

  async registrarIngresoEventoGrupo(
    eventoId: string,
    monto: number,
    descripcion: string,
    responsableId: string,
    medioPago: MedioPago,
    registradoPorId?: string,
  ): Promise<void> {
    const evento = await this.findOne(eventoId);

    if (evento.tipo !== TipoEvento.GRUPO) {
      throw new BadRequestException(
        'Este endpoint es solo para eventos de grupo',
      );
    }

    const cajaGrupo = await this.cajasService.findCajaGrupo();

    await this.movimientosService.create(
      {
        cajaId: cajaGrupo.id,
        tipo: TipoMovimiento.INGRESO,
        monto,
        concepto: ConceptoMovimiento.EVENTO_GRUPO_INGRESO,
        descripcion: `${descripcion} - Evento "${evento.nombre}"`,
        responsableId,
        medioPago,
        estadoPago: EstadoPago.PAGADO,
        eventoId,
      },
      registradoPorId,
    );
  }

  async registrarGastoEvento(
    eventoId: string,
    monto: number,
    descripcion: string,
    responsableId: string,
    medioPago: MedioPago,
    estadoPago: EstadoPago,
    personaAReembolsarId?: string,
    registradoPorId?: string,
  ): Promise<void> {
    const evento = await this.findOne(eventoId);
    const cajaGrupo = await this.cajasService.findCajaGrupo();

    const concepto =
      evento.tipo === TipoEvento.VENTA
        ? ConceptoMovimiento.EVENTO_VENTA_GASTO
        : ConceptoMovimiento.EVENTO_GRUPO_GASTO;

    await this.movimientosService.create(
      {
        cajaId: cajaGrupo.id,
        tipo: TipoMovimiento.EGRESO,
        monto,
        concepto,
        descripcion: `${descripcion} - Evento "${evento.nombre}"`,
        responsableId,
        medioPago,
        estadoPago,
        personaAReembolsarId,
        eventoId,
      },
      registradoPorId,
    );
  }

  async getKpisEvento(eventoId: string): Promise<{
    totalIngresos: number;
    totalGastadoEfectivo: number;
    totalPendienteReembolso: number;
    balance: number;
  }> {
    await this.findOne(eventoId);

    const movimientos = await this.movimientosService.findByRelatedEntity(
      'evento',
      eventoId,
    );

    const totalIngresos = movimientos
      .filter((m) => m.tipo === TipoMovimiento.INGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const gastosEvento = movimientos.filter(
      (m) => m.tipo === TipoMovimiento.EGRESO,
    );

    const totalGastadoEfectivo = gastosEvento
      .filter((m) => m.estadoPago === EstadoPago.PAGADO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const totalPendienteReembolso = gastosEvento
      .filter((m) => m.estadoPago === EstadoPago.PENDIENTE_REEMBOLSO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    return {
      totalIngresos,
      totalGastadoEfectivo,
      totalPendienteReembolso,
      balance: totalIngresos - totalGastadoEfectivo,
    };
  }

  async getResumenVentas(eventoId: string): Promise<{
    productos: Array<{
      nombre: string;
      precioCosto: number;
      precioVenta: number;
      cantidadVendida: number;
      ganancia: number;
    }>;
    ventasPorVendedor: Array<{
      vendedorId: string;
      vendedorNombre: string;
      cantidadTotal: number;
      gananciaTotal: number;
    }>;
    gananciaTotal: number;
  }> {
    await this.findOne(eventoId); // Validate event exists
    const productos = await this.findProductosByEvento(eventoId);
    const ventas = await this.ventaProductoRepository.find({
      where: { eventoId },
      relations: ['producto', 'vendedor'],
    });

    // Resumen por producto
    const resumenProductos = productos.map((p) => {
      const ventasProducto = ventas.filter((v) => v.productoId === p.id);
      const cantidadVendida = ventasProducto.reduce(
        (sum, v) => sum + v.cantidad,
        0,
      );
      const gananciaUnitaria = Number(p.precioVenta) - Number(p.precioCosto);

      return {
        nombre: p.nombre,
        precioCosto: Number(p.precioCosto),
        precioVenta: Number(p.precioVenta),
        cantidadVendida,
        ganancia: gananciaUnitaria * cantidadVendida,
      };
    });

    // Resumen por vendedor
    const ventasPorVendedor = new Map<
      string,
      { nombre: string; cantidad: number; ganancia: number }
    >();

    for (const venta of ventas) {
      const producto = productos.find((p) => p.id === venta.productoId);
      if (!producto) continue;

      const gananciaUnitaria =
        Number(producto.precioVenta) - Number(producto.precioCosto);
      const gananciaVenta = gananciaUnitaria * venta.cantidad;

      const actual = ventasPorVendedor.get(venta.vendedorId) || {
        nombre: venta.vendedor.nombre,
        cantidad: 0,
        ganancia: 0,
      };

      ventasPorVendedor.set(venta.vendedorId, {
        nombre: actual.nombre,
        cantidad: actual.cantidad + venta.cantidad,
        ganancia: actual.ganancia + gananciaVenta,
      });
    }

    const resumenVendedores = Array.from(ventasPorVendedor.entries()).map(
      ([vendedorId, data]) => ({
        vendedorId,
        vendedorNombre: data.nombre,
        cantidadTotal: data.cantidad,
        gananciaTotal: data.ganancia,
      }),
    );

    return {
      productos: resumenProductos,
      ventasPorVendedor: resumenVendedores,
      gananciaTotal: resumenProductos.reduce((sum, p) => sum + p.ganancia, 0),
    };
  }
}
