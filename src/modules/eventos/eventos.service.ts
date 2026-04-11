import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
import { Movimiento } from '../movimientos/entities/movimiento.entity';

/**
 * Minimal shape needed by venta-derived movimiento creation.
 * Both `findCajaGrupo` (returns CajaResponseDto) and
 * `getOrCreateCajaPersonal` (returns Caja entity) satisfy this.
 */
interface CajaRef {
  readonly id: string;
}
import {
  TipoEvento,
  DestinoGanancia,
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
  VENTA_DERIVED_CONCEPTOS,
} from '../../common/enums';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { APP_TIMEZONE } from '../../common/constants';
import { EVENTOS_ERROR_MESSAGES, PRODUCTOS_ERROR_MESSAGES } from './constants';

/**
 * Escapes characters that have special meaning in Postgres `LIKE`/`ILIKE`
 * patterns (`%`, `_`, `\`). Without this a caller could pass `vendedor=%`
 * and effectively match every row, bypassing the intent of the filter.
 */
function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}

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
    private readonly dataSource: DataSource,
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
      throw new NotFoundException(EVENTOS_ERROR_MESSAGES.EVENTO_NOT_FOUND(id));
    }

    return evento;
  }

  /**
   * Throws BadRequestException when the event is closed.
   *
   * Use this from any path that mutates an evento (or its ventas / movimientos
   * derived from ventas) to enforce immutability after the close-event flow.
   * The check is centralised here so the rule has a single source of truth.
   */
  assertEventoModificable(evento: Evento): void {
    if (evento.estaCerrado) {
      throw new BadRequestException(EVENTOS_ERROR_MESSAGES.EVENTO_CERRADO);
    }
  }

  async create(dto: CreateEventoDto): Promise<Evento> {
    const evento = this.eventoRepository.create(dto);
    return this.eventoRepository.save(evento);
  }

  async update(id: string, dto: UpdateEventoDto): Promise<Evento> {
    const evento = await this.findOne(id);
    const updated = this.eventoRepository.merge(evento, dto);
    return this.eventoRepository.save(updated);
  }

  /**
   * Soft-deletes an evento and everything attached to it.
   *
   * Cascade order (inside one transaction):
   *   1. Movimientos that came from ventas (concepto = EVENTO_VENTA_*)
   *   2. Ventas of the evento
   *   3. Productos of the evento
   *   4. The evento itself
   *
   * Pre-conditions:
   *   - Evento must be modificable (`estaCerrado === false`).
   *   - DeletionValidator must allow it: blocks if there are MANUAL movimientos
   *     attached to the evento (ones with no live venta pointing at them).
   *
   * The cascade is wrapped in a single dataSource.transaction; on any failure
   * the whole tree stays intact.
   */
  async remove(id: string): Promise<void> {
    const evento = await this.findOne(id);
    this.assertEventoModificable(evento);

    const check = await this.deletionValidator.canDeleteEvento(id);
    if (!check.canDelete) {
      throw new BadRequestException(check.reason);
    }

    await this.dataSource.transaction((manager) =>
      this.cascadeRemoveEvento(manager, evento),
    );
  }

  /**
   * Cascade body extracted so the orchestration in `remove` stays small
   * and the helper is independently testable.
   */
  private async cascadeRemoveEvento(
    manager: EntityManager,
    evento: Evento,
  ): Promise<void> {
    await this.softRemoveVentaDerivedMovimientos(manager, evento.id);
    await this.softRemoveAllVentasOfEvento(manager, evento.id);
    await this.softRemoveAllProductosOfEvento(manager, evento.id);
    await manager.softRemove(evento);
  }

  private async softRemoveVentaDerivedMovimientos(
    manager: EntityManager,
    eventoId: string,
  ): Promise<void> {
    const movimientos = await manager
      .createQueryBuilder(Movimiento, 'm')
      .where('m.evento_id = :eventoId', { eventoId })
      .andWhere('m.concepto IN (:...conceptos)', {
        conceptos: VENTA_DERIVED_CONCEPTOS,
      })
      .andWhere('m."deletedAt" IS NULL')
      .getMany();
    if (movimientos.length === 0) return;
    await manager.softRemove(movimientos);
  }

  private async softRemoveAllVentasOfEvento(
    manager: EntityManager,
    eventoId: string,
  ): Promise<void> {
    const ventas = await manager.find(VentaProducto, {
      where: { eventoId },
    });
    if (ventas.length === 0) return;
    await manager.softRemove(ventas);
  }

  private async softRemoveAllProductosOfEvento(
    manager: EntityManager,
    eventoId: string,
  ): Promise<void> {
    const productos = await manager.find(Producto, {
      where: { eventoId },
    });
    if (productos.length === 0) return;
    await manager.softRemove(productos);
  }

  // ==================== PRODUCTOS ====================

  async createProducto(
    dto: CreateProductoDto & { eventoId: string },
  ): Promise<Producto> {
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

  async findProductosConVentas(
    eventoId: string,
  ): Promise<Array<Producto & { cantidadVendida: number }>> {
    const [productos, ventas] = await Promise.all([
      this.findProductosByEvento(eventoId),
      this.ventaProductoRepository.find({ where: { eventoId } }),
    ]);

    // Pre-group ventas by productoId: O(N) instead of O(N*M)
    const ventasPorProducto = new Map<string, number>();
    for (const v of ventas) {
      ventasPorProducto.set(
        v.productoId,
        (ventasPorProducto.get(v.productoId) ?? 0) + v.cantidad,
      );
    }

    return productos.map((p) => ({
      ...p,
      cantidadVendida: ventasPorProducto.get(p.id) ?? 0,
    }));
  }

  /**
   * Soft delete de producto - solo si el evento no tiene movimientos
   *
   * Cascada: Elimina todas las ventas de este producto
   */
  async removeProducto(id: string): Promise<void> {
    const producto = await this.productoRepository.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException(
        PRODUCTOS_ERROR_MESSAGES.PRODUCTO_NOT_FOUND(id),
      );
    }

    // Validar que el evento no tenga movimientos
    const check = await this.deletionValidator.canDeleteEvento(
      producto.eventoId,
    );
    if (!check.canDelete) {
      throw new BadRequestException(
        PRODUCTOS_ERROR_MESSAGES.CANNOT_DELETE_WITH_MOVEMENTS,
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
    const evento = await this.findOne(dto.eventoId);
    const producto = await this.findProductoOfEvento(
      dto.productoId,
      dto.eventoId,
    );
    await this.personasService.findOne(dto.vendedorId);

    return this.dataSource.transaction((manager) =>
      this.persistVentaIndividual(manager, evento, producto, dto),
    );
  }

  async registrarVentasLote(
    eventoId: string,
    dto: RegisterVentasLoteDto,
  ): Promise<VentaProducto[]> {
    const evento = await this.findOne(eventoId);
    await this.personasService.findOne(dto.vendedorId);

    const productosMap = await this.loadProductosMap(eventoId);
    this.assertItemsBelongToEvento(dto.items, productosMap);

    return this.dataSource.transaction((manager) =>
      this.persistVentasLote(manager, evento, productosMap, dto),
    );
  }

  // ----- VENTAS: orquestación transaccional -----

  private async persistVentaIndividual(
    manager: EntityManager,
    evento: Evento,
    producto: Producto,
    dto: CreateVentaProductoDto,
  ): Promise<VentaProducto> {
    const ventaEntity = manager.create(VentaProducto, {
      eventoId: dto.eventoId,
      productoId: dto.productoId,
      vendedorId: dto.vendedorId,
      cantidad: dto.cantidad,
    });
    const savedVenta = await manager.save(ventaEntity);

    if (!this.shouldGenerateMovimientoIngreso(evento)) {
      return savedVenta;
    }

    const movimiento = await this.crearMovimientoIngresoVentaInTx(manager, {
      evento,
      vendedorId: dto.vendedorId,
      medioPago: dto.medioPago,
      monto: this.computeGananciaProducto(producto, dto.cantidad),
      descripcion: this.buildVentaDescripcion(producto, evento),
    });

    savedVenta.movimientoId = movimiento.id;
    return manager.save(savedVenta);
  }

  private async persistVentasLote(
    manager: EntityManager,
    evento: Evento,
    productosMap: ReadonlyMap<string, Producto>,
    dto: RegisterVentasLoteDto,
  ): Promise<VentaProducto[]> {
    const ventasToCreate = dto.items.map((item) =>
      manager.create(VentaProducto, {
        eventoId: evento.id,
        productoId: item.productoId,
        vendedorId: dto.vendedorId,
        cantidad: item.cantidad,
      }),
    );
    const savedVentas = await manager.save(ventasToCreate);

    if (!this.shouldGenerateMovimientoIngreso(evento)) {
      return savedVentas;
    }

    const movimiento = await this.crearMovimientoIngresoVentaInTx(manager, {
      evento,
      vendedorId: dto.vendedorId,
      medioPago: dto.medioPago,
      monto: this.computeGananciaTotalLote(dto.items, productosMap),
      descripcion: this.buildVentasLoteDescripcion(
        dto.items,
        productosMap,
        evento,
      ),
    });

    for (const venta of savedVentas) {
      venta.movimientoId = movimiento.id;
    }
    return manager.save(savedVentas);
  }

  // ----- VENTAS: helpers privados -----

  private async findProductoOfEvento(
    productoId: string,
    eventoId: string,
  ): Promise<Producto> {
    const producto = await this.productoRepository.findOne({
      where: { id: productoId },
    });
    if (!producto) {
      throw new NotFoundException(
        PRODUCTOS_ERROR_MESSAGES.PRODUCTO_NOT_FOUND(productoId),
      );
    }
    if (producto.eventoId !== eventoId) {
      throw new BadRequestException(
        PRODUCTOS_ERROR_MESSAGES.PRODUCTO_NOT_IN_EVENTO,
      );
    }
    return producto;
  }

  private async loadProductosMap(
    eventoId: string,
  ): Promise<Map<string, Producto>> {
    const productosEvento = await this.findProductosByEvento(eventoId);
    return new Map(productosEvento.map((p) => [p.id, p]));
  }

  private assertItemsBelongToEvento(
    items: ReadonlyArray<{ productoId: string }>,
    productosMap: ReadonlyMap<string, Producto>,
  ): void {
    for (const item of items) {
      if (!productosMap.has(item.productoId)) {
        throw new NotFoundException(
          PRODUCTOS_ERROR_MESSAGES.PRODUCTO_NOT_FOUND_IN_EVENTO(
            item.productoId,
          ),
        );
      }
    }
  }

  private shouldGenerateMovimientoIngreso(evento: Evento): boolean {
    return evento.tipo === TipoEvento.VENTA && evento.destinoGanancia !== null;
  }

  private computeGananciaProducto(
    producto: Producto,
    cantidad: number,
  ): number {
    const margen = Number(producto.precioVenta) - Number(producto.precioCosto);
    return margen * cantidad;
  }

  private computeGananciaTotalLote(
    items: ReadonlyArray<{ productoId: string; cantidad: number }>,
    productosMap: ReadonlyMap<string, Producto>,
  ): number {
    return items.reduce((sum, item) => {
      const producto = productosMap.get(item.productoId);
      if (!producto) return sum;
      return sum + this.computeGananciaProducto(producto, item.cantidad);
    }, 0);
  }

  private buildVentaDescripcion(producto: Producto, evento: Evento): string {
    return `Venta "${producto.nombre}" - Evento "${evento.nombre}"`;
  }

  private buildVentasLoteDescripcion(
    items: ReadonlyArray<{ productoId: string }>,
    productosMap: ReadonlyMap<string, Producto>,
    evento: Evento,
  ): string {
    const nombres = items
      .map((item) => productosMap.get(item.productoId)?.nombre ?? '')
      .filter((nombre) => nombre.length > 0)
      .join(', ');
    return `Ventas (${nombres}) - Evento "${evento.nombre}"`;
  }

  private async resolveCajaForVenta(
    evento: Evento,
    vendedorId: string,
  ): Promise<CajaRef> {
    if (evento.destinoGanancia === DestinoGanancia.CAJA_GRUPO) {
      return this.cajasService.findCajaGrupo();
    }
    return this.cajasService.getOrCreateCajaPersonal(vendedorId);
  }

  /**
   * Creates the income movimiento associated to a venta INSIDE an active
   * transaction. Caller is responsible for opening / committing / rolling back.
   *
   * Note: caja resolution can call cajasService.getOrCreateCajaPersonal which
   * may write to the DB. That write happens through the regular repository
   * (not the manager) — acceptable for now because:
   *   1. Creating a personal caja is idempotent (find-or-create).
   *   2. If the outer transaction rolls back the venta + movimiento, the
   *      personal caja is harmless leftover state, never an inconsistent
   *      financial record.
   * If we ever need that write to also rollback, we'd add a manager-aware
   * variant of getOrCreateCajaPersonal.
   */
  private async crearMovimientoIngresoVentaInTx(
    manager: EntityManager,
    params: {
      evento: Evento;
      vendedorId: string;
      medioPago: MedioPago;
      monto: number;
      descripcion: string;
    },
  ): Promise<Movimiento> {
    const caja = await this.resolveCajaForVenta(
      params.evento,
      params.vendedorId,
    );
    return this.movimientosService.createWithManager(manager, {
      cajaId: caja.id,
      tipo: TipoMovimiento.INGRESO,
      monto: params.monto,
      concepto: ConceptoMovimiento.EVENTO_VENTA_INGRESO,
      descripcion: params.descripcion,
      responsableId: params.vendedorId,
      medioPago: params.medioPago,
      estadoPago: EstadoPago.PAGADO,
      eventoId: params.evento.id,
    });
  }

  async findVentasByEvento(
    eventoId: string,
    vendedorFilter?: string,
  ): Promise<VentaProducto[]> {
    const qb = this.ventaProductoRepository
      .createQueryBuilder('venta')
      .leftJoinAndSelect('venta.producto', 'producto')
      .leftJoinAndSelect('venta.vendedor', 'vendedor')
      .where('venta.eventoId = :eventoId', { eventoId })
      // Cast to date in the application timezone so two ventas the same
      // local day always group together, even when one was recorded after
      // 21:00 BA (= next day in UTC). The identifier is hand-quoted
      // because TypeORM does not auto-quote raw expressions.
      .orderBy(`("venta"."createdAt" AT TIME ZONE :tz)::date`, 'DESC')
      .addOrderBy('vendedor.nombre', 'ASC')
      .addOrderBy('producto.nombre', 'ASC')
      .setParameter('tz', APP_TIMEZONE);

    const trimmed = vendedorFilter?.trim();
    if (trimmed) {
      qb.andWhere('vendedor.nombre ILIKE :nombre', {
        nombre: `%${escapeLikePattern(trimmed)}%`,
      });
    }

    return qb.getMany();
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

  // ==================== MOVIMIENTOS ====================

  async findMovimientosByEvento(
    eventoId: string,
    filters: { tipo?: TipoMovimiento; concepto?: ConceptoMovimiento } = {},
  ) {
    await this.findOne(eventoId); // Validar que el evento existe
    return this.movimientosService.findMovimientosByEvento(eventoId, filters);
  }

  // ==================== DETALLE CON RESUMEN FINANCIERO ====================

  async getEventoDetalle(id: string): Promise<
    Evento & {
      resumenFinanciero: {
        totalRecaudado: number;
        gananciaVentas: number;
        totalGastado: number;
        totalPendienteReembolso: number;
        balance: number;
      };
    }
  > {
    const [evento, kpis] = await Promise.all([
      this.findOne(id),
      this.getKpisEvento(id),
    ]);

    return { ...evento, resumenFinanciero: kpis };
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
        EVENTOS_ERROR_MESSAGES.ONLY_FOR_EVENTO_GRUPO,
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
    totalRecaudado: number;
    gananciaVentas: number;
    totalGastado: number;
    totalPendienteReembolso: number;
    balance: number;
  }> {
    await this.findOne(eventoId);

    const [movimientos, ventas, productos] = await Promise.all([
      this.movimientosService.findByRelatedEntity('evento', eventoId),
      this.ventaProductoRepository.find({ where: { eventoId } }),
      this.productoRepository.find({ where: { eventoId } }),
    ]);

    // Dinero real cobrado a los clientes: precioVenta × cantidad
    const productosMap = new Map(productos.map((p) => [p.id, p]));
    const totalRecaudado = ventas.reduce((sum, v) => {
      const producto = productosMap.get(v.productoId);
      return sum + (producto ? Number(producto.precioVenta) * v.cantidad : 0);
    }, 0);

    // Ganancia neta de ventas: (precioVenta - precioCosto) × cantidad
    const gananciaVentas = movimientos
      .filter((m) => m.tipo === TipoMovimiento.INGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const gastosEvento = movimientos.filter(
      (m) => m.tipo === TipoMovimiento.EGRESO,
    );

    const totalGastado = gastosEvento
      .filter((m) => m.estadoPago === EstadoPago.PAGADO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const totalPendienteReembolso = gastosEvento
      .filter((m) => m.estadoPago === EstadoPago.PENDIENTE_REEMBOLSO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    return {
      totalRecaudado,
      gananciaVentas,
      totalGastado,
      totalPendienteReembolso,
      balance: gananciaVentas - totalGastado,
    };
  }

  async getResumenVentas(
    eventoId: string,
    vendedorFilter?: string,
  ): Promise<{
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
      desglose: Array<{
        productoId: string;
        nombreProducto: string;
        cantidad: number;
        ganancia: number;
      }>;
    }>;
    gananciaTotal: number;
  }> {
    await this.findOne(eventoId); // Validate event exists
    const productos = await this.findProductosByEvento(eventoId);
    const ventas = await this.ventaProductoRepository.find({
      where: { eventoId },
      relations: ['producto', 'vendedor'],
    });

    // Pre-group ventas by productoId: O(N) instead of O(N*M)
    const ventasPorProductoMap = new Map<string, number>();
    for (const v of ventas) {
      ventasPorProductoMap.set(
        v.productoId,
        (ventasPorProductoMap.get(v.productoId) ?? 0) + v.cantidad,
      );
    }

    // Resumen por producto
    const resumenProductos = productos.map((p) => {
      const cantidadVendida = ventasPorProductoMap.get(p.id) ?? 0;
      const gananciaUnitaria = Number(p.precioVenta) - Number(p.precioCosto);
      return {
        nombre: p.nombre,
        precioCosto: Number(p.precioCosto),
        precioVenta: Number(p.precioVenta),
        cantidadVendida,
        ganancia: gananciaUnitaria * cantidadVendida,
      };
    });

    // Pre-build productos lookup: O(1) per access instead of O(N)
    const productosMap = new Map(productos.map((p) => [p.id, p]));

    // Resumen por vendedor
    const ventasPorVendedor = new Map<
      string,
      {
        nombre: string;
        cantidad: number;
        ganancia: number;
        desglose: Map<
          string,
          { nombre: string; cantidad: number; ganancia: number }
        >;
      }
    >();

    for (const venta of ventas) {
      const producto = productosMap.get(venta.productoId); // O(1)
      if (!producto) continue;

      const gananciaUnitaria =
        Number(producto.precioVenta) - Number(producto.precioCosto);
      const gananciaVenta = gananciaUnitaria * venta.cantidad;

      const actual = ventasPorVendedor.get(venta.vendedorId) ?? {
        nombre: venta.vendedor.nombre,
        cantidad: 0,
        ganancia: 0,
        desglose: new Map<
          string,
          { nombre: string; cantidad: number; ganancia: number }
        >(),
      };

      const actualDesglose = actual.desglose.get(venta.productoId) ?? {
        nombre: producto.nombre,
        cantidad: 0,
        ganancia: 0,
      };

      actual.desglose.set(venta.productoId, {
        nombre: actualDesglose.nombre,
        cantidad: actualDesglose.cantidad + venta.cantidad,
        ganancia: actualDesglose.ganancia + gananciaVenta,
      });
      actual.cantidad += venta.cantidad;
      actual.ganancia += gananciaVenta;
      ventasPorVendedor.set(venta.vendedorId, actual);
    }

    const resumenVendedores = Array.from(ventasPorVendedor.entries()).map(
      ([vendedorId, data]) => ({
        vendedorId,
        vendedorNombre: data.nombre,
        cantidadTotal: data.cantidad,
        gananciaTotal: data.ganancia,
        desglose: Array.from(data.desglose.entries()).map(
          ([productoId, d]) => ({
            productoId,
            nombreProducto: d.nombre,
            cantidad: d.cantidad,
            ganancia: d.ganancia,
          }),
        ),
      }),
    );

    const vendedoresFiltrados = vendedorFilter
      ? resumenVendedores.filter((v) =>
          v.vendedorNombre.toLowerCase().includes(vendedorFilter.toLowerCase()),
        )
      : resumenVendedores;

    return {
      productos: resumenProductos,
      ventasPorVendedor: vendedoresFiltrados,
      gananciaTotal: resumenProductos.reduce((sum, p) => sum + p.ganancia, 0),
    };
  }
}
