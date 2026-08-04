import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { Evento } from './entities/evento.entity';
import { Producto } from './entities/producto.entity';
import { VentaProducto } from './entities/venta-producto.entity';
import { Entrega } from './entities/entrega.entity';
import { EntregaLinea } from './entities/entrega-linea.entity';
import { CreateEventoDto } from './dtos/create-evento.dto';
import { UpdateEventoDto } from './dtos/update-evento.dto';
import { CreateProductoDto } from './dtos/create-producto.dto';
import { UpdateProductoDto } from './dtos/update-producto.dto';
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
  ModalidadVenta,
  EstadoCobroVenta,
  VENTA_DERIVED_CONCEPTOS,
} from '../../common/enums';

/**
 * Everything the two venta-movimiento creators need. `destino` and
 * `estadoPago` come from the VENTA (not the evento), and `responsableId` is
 * separate from `vendedorId`: when a colectivo sells, the vendedor is the
 * collective but a real person answers for the cash.
 */
interface MovimientoVentaParams {
  readonly evento: Evento;
  readonly vendedorId: string;
  readonly responsableId: string;
  readonly destino: DestinoGanancia;
  readonly estadoPago: EstadoPago;
  readonly medioPago: MedioPago;
  readonly monto: number;
  readonly descripcion: string;
}
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { APP_TIMEZONE } from '../../common/constants';
import {
  EVENTOS_ERROR_MESSAGES,
  PRODUCTOS_ERROR_MESSAGES,
  ENTREGA_INMEDIATA_NOTA,
} from './constants';
import { escapeLikePattern } from '../../common/utils';

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
    this.validateTipoDestinoGanancia(dto);
    const evento = this.eventoRepository.create(dto);
    return this.eventoRepository.save(evento);
  }

  async update(id: string, dto: UpdateEventoDto): Promise<Evento> {
    const evento = await this.findOne(id);
    this.assertEventoModificable(evento);
    this.validateTipoDestinoGanancia(dto, evento);
    const updated = this.eventoRepository.merge(evento, dto);
    return this.eventoRepository.save(updated);
  }

  async cerrarEvento(id: string): Promise<Evento> {
    const evento = await this.findOne(id);
    if (evento.estaCerrado) {
      throw new BadRequestException(EVENTOS_ERROR_MESSAGES.EVENTO_YA_CERRADO);
    }
    return this.eventoRepository.save({ ...evento, estaCerrado: true });
  }

  /**
   * Enables movimientos for a VENTA event (irreversible false → true).
   *
   * Pre-conditions:
   *   - The event is of type VENTA.
   *   - The event is modificable (not cerrado).
   *   - Movimientos are not already habilitados.
   *   - Every producto has a precioCosto (precioVenta is always NOT NULL).
   *
   * On success it flips the flag and back-fills the movimientos of the ventas
   * already loaded (which until now had no movimiento): ONE ingreso movimiento
   * per vendedor (sum of their ganancias), plus — for destino cuentas_personales
   * — ONE recupero movimiento per vendedor. Back-filled movimientos use
   * medioPago efectivo because the original ventas never persisted it.
   */
  async habilitarMovimientos(id: string): Promise<Evento> {
    const evento = await this.findOne(id);

    if (evento.tipo !== TipoEvento.VENTA) {
      throw new BadRequestException(
        EVENTOS_ERROR_MESSAGES.MOVIMIENTOS_SOLO_PARA_VENTA,
      );
    }
    this.assertEventoModificable(evento);
    if (evento.movimientosHabilitados) {
      throw new BadRequestException(
        EVENTOS_ERROR_MESSAGES.MOVIMIENTOS_YA_HABILITADOS,
      );
    }
    this.assertProductosTienenCosto(evento);

    return this.dataSource.transaction((manager) =>
      this.persistHabilitarMovimientos(manager, evento),
    );
  }

  private assertProductosTienenCosto(evento: Evento): void {
    const productos = evento.productos ?? [];
    if (productos.length === 0) {
      throw new BadRequestException(
        EVENTOS_ERROR_MESSAGES.SIN_PRODUCTOS_PARA_HABILITAR,
      );
    }
    const sinCosto = productos.filter(
      (p) => p.precioCosto === null || Number(p.precioCosto) <= 0,
    );
    if (sinCosto.length > 0) {
      const nombres = sinCosto.map((p) => p.nombre).join(', ');
      throw new BadRequestException(
        EVENTOS_ERROR_MESSAGES.PRODUCTOS_SIN_COSTO(nombres),
      );
    }
  }

  private async persistHabilitarMovimientos(
    manager: EntityManager,
    evento: Evento,
  ): Promise<Evento> {
    // Flip atómico: solo pasa de false → true. Si otra ejecución concurrente
    // ya lo habilitó, affected === 0 y abortamos sin duplicar movimientos.
    const result = await manager.update(
      Evento,
      { id: evento.id, movimientosHabilitados: false },
      { movimientosHabilitados: true },
    );
    if (!result.affected) {
      throw new BadRequestException(
        EVENTOS_ERROR_MESSAGES.MOVIMIENTOS_YA_HABILITADOS,
      );
    }

    const ventasSinMovimiento = await manager.find(VentaProducto, {
      where: { eventoId: evento.id, movimientoId: IsNull() },
      relations: ['producto'],
    });

    for (const ventas of this.groupVentasForBackfill(
      ventasSinMovimiento,
    ).values()) {
      await this.backfillMovimientosVendedor(manager, { evento, ventas });
    }

    return { ...evento, movimientosHabilitados: true };
  }

  /**
   * Agrupa las ventas que van a compartir UN movimiento agregado.
   *
   * La clave es (vendedor, destino, estadoCobro) y no sólo el vendedor: en un
   * evento mixto la misma persona puede tener ventas con destinos distintos, y
   * cualquiera puede tener ventas cobradas e impagas a la vez. Si la clave no
   * incluye los tres, un vendedor recibiría un único movimiento a la caja
   * equivocada, mezclando además plata cobrada con plata a cobrar.
   */
  private groupVentasForBackfill(
    ventas: ReadonlyArray<VentaProducto>,
  ): Map<string, VentaProducto[]> {
    const grouped = new Map<string, VentaProducto[]>();
    for (const venta of ventas) {
      const key = `${venta.vendedorId}|${venta.destinoGanancia}|${venta.estadoCobro}`;
      const current = grouped.get(key) ?? [];
      current.push(venta);
      grouped.set(key, current);
    }
    return grouped;
  }

  /**
   * Back-fills the income (and optional recupero) movimiento for all the
   * ventas of a single vendedor, then links them. Reuses the same in-tx
   * creators and ganancia/costo helpers as the live-sale path.
   */
  private async backfillMovimientosVendedor(
    manager: EntityManager,
    params: {
      evento: Evento;
      ventas: VentaProducto[];
    },
  ): Promise<void> {
    const { evento, ventas } = params;
    // Todas las ventas del grupo comparten vendedor, destino y estadoCobro
    // por construcción de groupVentasForBackfill, así que la primera manda.
    const { vendedorId, destinoGanancia, estadoCobro } = ventas[0];
    const items = ventas.map((v) => ({
      productoId: v.productoId,
      cantidad: v.cantidad,
    }));
    const productosMap = new Map<string, Producto>(
      ventas.filter((v) => v.producto).map((v) => [v.productoId, v.producto]),
    );

    const movimientoParams = {
      evento,
      vendedorId,
      responsableId: vendedorId,
      destino: destinoGanancia,
      estadoPago: this.resolveEstadoPago(estadoCobro),
      medioPago: MedioPago.EFECTIVO,
    };

    const movimiento = await this.crearMovimientoIngresoVentaInTx(manager, {
      ...movimientoParams,
      monto: this.computeGananciaTotalLote(items, productosMap),
      descripcion: this.buildVentasLoteDescripcion(items, productosMap, evento),
    });
    for (const venta of ventas) {
      venta.movimientoId = movimiento.id;
    }

    if (this.shouldGenerateRecuperoCosto(destinoGanancia)) {
      const recupero = await this.crearMovimientoRecuperoVentaInTx(manager, {
        ...movimientoParams,
        monto: this.computeCostoTotalLote(items, productosMap),
        descripcion: this.buildRecuperoLoteDescripcion(
          items,
          productosMap,
          evento,
        ),
      });
      for (const venta of ventas) {
        venta.movimientoRecuperoId = recupero.id;
      }
    }

    await manager.save(ventas);
  }

  /**
   * Updates only the reportePublico flag — intentionally bypasses
   * assertEventoModificable so the toggle works on closed events too.
   */
  async updateReportePublico(
    id: string,
    reportePublico: boolean,
  ): Promise<Evento> {
    const evento = await this.findOne(id);
    return this.eventoRepository.save({ ...evento, reportePublico });
  }

  private validateTipoDestinoGanancia(
    dto: CreateEventoDto | UpdateEventoDto,
    currentEvento?: Evento,
  ): void {
    const tipoToValidate = dto.tipo ?? currentEvento?.tipo;
    const destinoToValidate =
      dto.destinoGanancia ?? currentEvento?.destinoGanancia;
    const modalidadToValidate =
      dto.modalidadVenta ?? currentEvento?.modalidadVenta;

    if (tipoToValidate === TipoEvento.VENTA) {
      // MIXTA no tiene un destino único: cada venta define el suyo. El destino
      // a nivel evento sólo es obligatorio para la modalidad UNICA.
      if (modalidadToValidate !== ModalidadVenta.MIXTA && !destinoToValidate) {
        throw new BadRequestException(
          EVENTOS_ERROR_MESSAGES.VENTA_REQUIRES_DESTINO_GANANCIA,
        );
      }
    }

    if (tipoToValidate === TipoEvento.GRUPO) {
      if (destinoToValidate) {
        throw new BadRequestException(
          EVENTOS_ERROR_MESSAGES.GRUPO_CANNOT_HAVE_DESTINO_GANANCIA,
        );
      }
    }
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
    await this.softRemoveEntregasOfEvento(manager, evento.id);
    await this.softRemoveVentaDerivedMovimientos(manager, evento.id);
    await this.softRemoveAllVentasOfEvento(manager, evento.id);
    await this.softRemoveAllProductosOfEvento(manager, evento.id);
    await manager.softRemove(evento);
  }

  /**
   * Soft-removes every EntregaLinea, then every Entrega header of the evento.
   * Children first, then headers, so any future hooks observing the header
   * delete still see the lines as live just before they go away.
   */
  private async softRemoveEntregasOfEvento(
    manager: EntityManager,
    eventoId: string,
  ): Promise<void> {
    const entregas = await manager.find(Entrega, {
      where: { eventoId },
      relations: ['lineas'],
    });
    if (entregas.length === 0) return;

    const lineas = entregas.flatMap((e) => e.lineas ?? []);
    if (lineas.length > 0) await manager.softRemove(lineas);
    await manager.softRemove(entregas);
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
    const evento = await this.findOne(dto.eventoId);
    this.assertEventoModificable(evento);

    const producto = this.productoRepository.create(dto);
    return this.productoRepository.save(producto);
  }

  /**
   * Updates a producto. Used mainly to fill in the precioCosto once it is
   * known (the producto may have been created with only precioVenta).
   * Blocked when the evento is cerrado.
   */
  async updateProducto(id: string, dto: UpdateProductoDto): Promise<Producto> {
    const producto = await this.productoRepository.findOne({ where: { id } });
    if (!producto) {
      throw new NotFoundException(
        PRODUCTOS_ERROR_MESSAGES.PRODUCTO_NOT_FOUND(id),
      );
    }

    const evento = await this.findOne(producto.eventoId);
    this.assertEventoModificable(evento);
    this.assertPreciosEditables(evento, dto);

    return this.productoRepository.save({ ...producto, ...dto });
  }

  /**
   * Once movimientos are habilitados the income movimientos are already
   * computed from the current prices, so editing precioCosto/precioVenta would
   * desync the stored movimientos. Prices are frozen at that point; only
   * non-price fields (e.g. nombre) may still change.
   */
  private assertPreciosEditables(evento: Evento, dto: UpdateProductoDto): void {
    const cambiaPrecios =
      dto.precioCosto !== undefined || dto.precioVenta !== undefined;
    if (evento.movimientosHabilitados && cambiaPrecios) {
      throw new BadRequestException(
        PRODUCTOS_ERROR_MESSAGES.CANNOT_EDIT_PRICES_WITH_MOVIMIENTOS,
      );
    }
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

    const evento = await this.findOne(producto.eventoId);
    this.assertEventoModificable(evento);

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
    this.assertEventoModificable(evento);
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
    this.assertEventoModificable(evento);
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
    const destino = this.resolveDestinoVenta(evento);
    const ventaEntity = manager.create(VentaProducto, {
      eventoId: dto.eventoId,
      productoId: dto.productoId,
      vendedorId: dto.vendedorId,
      cantidad: dto.cantidad,
      destinoGanancia: destino,
      estadoCobro: EstadoCobroVenta.COBRADO,
    });
    const savedVenta = await manager.save(ventaEntity);

    if (!this.shouldGenerateMovimientoIngreso(evento)) {
      return savedVenta;
    }

    const movimientoParams = {
      evento,
      vendedorId: dto.vendedorId,
      responsableId: dto.vendedorId,
      destino,
      estadoPago: EstadoPago.PAGADO,
      medioPago: dto.medioPago,
    };

    const movimiento = await this.crearMovimientoIngresoVentaInTx(manager, {
      ...movimientoParams,
      monto: this.computeGananciaProducto(producto, dto.cantidad),
      descripcion: this.buildVentaDescripcion(producto, evento),
    });

    savedVenta.movimientoId = movimiento.id;

    if (this.shouldGenerateRecuperoCosto(destino)) {
      const recupero = await this.crearMovimientoRecuperoVentaInTx(manager, {
        ...movimientoParams,
        monto: this.computeCostoProducto(producto, dto.cantidad),
        descripcion: this.buildRecuperoDescripcion(producto, evento),
      });
      savedVenta.movimientoRecuperoId = recupero.id;
    }

    return manager.save(savedVenta);
  }

  private async persistVentasLote(
    manager: EntityManager,
    evento: Evento,
    productosMap: ReadonlyMap<string, Producto>,
    dto: RegisterVentasLoteDto,
  ): Promise<VentaProducto[]> {
    const destino = this.resolveDestinoVenta(evento, dto.destinoGanancia);
    const estadoCobro = dto.estadoCobro ?? EstadoCobroVenta.COBRADO;
    const responsableId = dto.responsableId ?? dto.vendedorId;

    const ventasToCreate = dto.items.map((item) =>
      manager.create(VentaProducto, {
        eventoId: evento.id,
        productoId: item.productoId,
        vendedorId: dto.vendedorId,
        cantidad: item.cantidad,
        destinoGanancia: destino,
        estadoCobro,
      }),
    );
    const savedVentas = await manager.save(ventasToCreate);

    if (dto.entregaInmediata) {
      await this.persistEntregaInmediataInTx(manager, evento, dto);
    }

    if (!this.shouldGenerateMovimientoIngreso(evento)) {
      return savedVentas;
    }

    const movimientoParams = {
      evento,
      vendedorId: dto.vendedorId,
      responsableId,
      destino,
      estadoPago: this.resolveEstadoPago(estadoCobro),
      medioPago: dto.medioPago,
    };

    const movimiento = await this.crearMovimientoIngresoVentaInTx(manager, {
      ...movimientoParams,
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

    if (this.shouldGenerateRecuperoCosto(destino)) {
      const recupero = await this.crearMovimientoRecuperoVentaInTx(manager, {
        ...movimientoParams,
        monto: this.computeCostoTotalLote(dto.items, productosMap),
        descripcion: this.buildRecuperoLoteDescripcion(
          dto.items,
          productosMap,
          evento,
        ),
      });
      for (const venta of savedVentas) {
        venta.movimientoRecuperoId = recupero.id;
      }
    }

    return manager.save(savedVentas);
  }

  /**
   * "Entregado en el acto" = crear la Entrega junto con la venta, en la misma
   * transacción. No hace falta ningún concepto nuevo: el stock disponible es
   * vendido − entregado, así que una entrega inmediata lo deja en cero y una
   * preventa lo deja pendiente. Todo con la maquinaria de entregas que ya existe.
   */
  private async persistEntregaInmediataInTx(
    manager: EntityManager,
    evento: Evento,
    dto: RegisterVentasLoteDto,
  ): Promise<void> {
    const entrega = await manager.save(
      manager.create(Entrega, {
        eventoId: evento.id,
        vendedorId: dto.vendedorId,
        fecha: new Date(),
        notas: ENTREGA_INMEDIATA_NOTA,
      }),
    );

    await manager.save(
      dto.items.map((item) =>
        manager.create(EntregaLinea, {
          entregaId: entrega.id,
          productoId: item.productoId,
          cantidad: item.cantidad,
        }),
      ),
    );
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
    return (
      evento.tipo === TipoEvento.VENTA &&
      evento.destinoGanancia !== null &&
      evento.movimientosHabilitados
    );
  }

  /**
   * The cost-recovery movimiento only applies to ventas whose margen goes to a
   * personal account: the caja grupo paid for the goods, so it gets the cost
   * back and nets to zero. With CAJA_GRUPO the margen already lands there, so
   * there is nothing to recover.
   *
   * Reads the DESTINO OF THE VENTA, not of the evento — in a MIXTA event two
   * ventas of the same evento can differ.
   */
  private shouldGenerateRecuperoCosto(destino: DestinoGanancia): boolean {
    return destino === DestinoGanancia.CUENTAS_PERSONALES;
  }

  /**
   * Resolves which destino applies to a lote, enforcing the modalidad:
   * - UNICA: inherits evento.destinoGanancia; sending one is rejected so the
   *   caller never believes it chose something it did not.
   * - MIXTA: the caller must declare it; there is no sensible default.
   */
  private resolveDestinoVenta(
    evento: Evento,
    destinoSolicitado?: DestinoGanancia,
  ): DestinoGanancia {
    if (evento.modalidadVenta === ModalidadVenta.MIXTA) {
      if (!destinoSolicitado) {
        throw new BadRequestException(
          EVENTOS_ERROR_MESSAGES.DESTINO_REQUERIDO_EN_MIXTA,
        );
      }
      return destinoSolicitado;
    }

    if (destinoSolicitado && destinoSolicitado !== evento.destinoGanancia) {
      throw new BadRequestException(
        EVENTOS_ERROR_MESSAGES.DESTINO_NO_APLICA_EN_UNICA,
      );
    }

    if (!evento.destinoGanancia) {
      throw new BadRequestException(
        EVENTOS_ERROR_MESSAGES.EVENTO_SIN_DESTINO(evento.id),
      );
    }
    return evento.destinoGanancia;
  }

  /**
   * The venta's estadoCobro is the source of truth; the movimiento's
   * estadoPago is derived from it. PENDIENTE means the money has not come in,
   * so the movimiento must not move the caja balance (see
   * MovimientosService.calcularSaldo).
   */
  private resolveEstadoPago(estadoCobro: EstadoCobroVenta): EstadoPago {
    return estadoCobro === EstadoCobroVenta.PENDIENTE
      ? EstadoPago.PENDIENTE_COBRO
      : EstadoPago.PAGADO;
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

  private computeCostoProducto(producto: Producto, cantidad: number): number {
    return Number(producto.precioCosto) * cantidad;
  }

  private computeCostoTotalLote(
    items: ReadonlyArray<{ productoId: string; cantidad: number }>,
    productosMap: ReadonlyMap<string, Producto>,
  ): number {
    return items.reduce((sum, item) => {
      const producto = productosMap.get(item.productoId);
      if (!producto) return sum;
      return sum + this.computeCostoProducto(producto, item.cantidad);
    }, 0);
  }

  private buildVentaDescripcion(producto: Producto, evento: Evento): string {
    return `Venta "${producto.nombre}" - Evento "${evento.nombre}"`;
  }

  private buildRecuperoDescripcion(producto: Producto, evento: Evento): string {
    return `Recupero costo "${producto.nombre}" - Evento "${evento.nombre}"`;
  }

  private joinProductoNombres(
    items: ReadonlyArray<{ productoId: string }>,
    productosMap: ReadonlyMap<string, Producto>,
  ): string {
    return items
      .map((item) => productosMap.get(item.productoId)?.nombre ?? '')
      .filter((nombre) => nombre.length > 0)
      .join(', ');
  }

  private buildVentasLoteDescripcion(
    items: ReadonlyArray<{ productoId: string }>,
    productosMap: ReadonlyMap<string, Producto>,
    evento: Evento,
  ): string {
    return `Ventas (${this.joinProductoNombres(items, productosMap)}) - Evento "${evento.nombre}"`;
  }

  private buildRecuperoLoteDescripcion(
    items: ReadonlyArray<{ productoId: string }>,
    productosMap: ReadonlyMap<string, Producto>,
    evento: Evento,
  ): string {
    return `Recupero costo (${this.joinProductoNombres(items, productosMap)}) - Evento "${evento.nombre}"`;
  }

  /**
   * Reads the destino OF THE VENTA, not of the evento: in a MIXTA event two
   * ventas of the same evento land in different cajas.
   *
   * For CUENTAS_PERSONALES the vendedor must be a real person —
   * getOrCreateCajaPersonal rejects colectivos, which is what makes "el grupo
   * vendió a una cuenta personal" impossible to represent.
   */
  private async resolveCajaForVenta(
    destino: DestinoGanancia,
    vendedorId: string,
  ): Promise<CajaRef> {
    if (destino === DestinoGanancia.CAJA_GRUPO) {
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
    params: MovimientoVentaParams,
  ): Promise<Movimiento> {
    const caja = await this.resolveCajaForVenta(
      params.destino,
      params.vendedorId,
    );
    return this.movimientosService.createWithManager(manager, {
      cajaId: caja.id,
      tipo: TipoMovimiento.INGRESO,
      monto: params.monto,
      concepto: ConceptoMovimiento.EVENTO_VENTA_INGRESO,
      descripcion: params.descripcion,
      responsableId: params.responsableId,
      medioPago: params.medioPago,
      estadoPago: params.estadoPago,
      eventoId: params.evento.id,
    });
  }

  /**
   * Creates the cost-recovery INGRESO movimiento into the caja grupo, INSIDE an
   * active transaction. Only call when shouldGenerateRecuperoCosto(destino) is
   * true. Mirrors crearMovimientoIngresoVentaInTx but always targets the caja
   * grupo and uses the recupero concepto.
   */
  private async crearMovimientoRecuperoVentaInTx(
    manager: EntityManager,
    params: MovimientoVentaParams,
  ): Promise<Movimiento> {
    const cajaGrupo = await this.cajasService.findCajaGrupo();
    return this.movimientosService.createWithManager(manager, {
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.INGRESO,
      monto: params.monto,
      concepto: ConceptoMovimiento.EVENTO_VENTA_RECUPERO_COSTO,
      descripcion: params.descripcion,
      responsableId: params.responsableId,
      medioPago: params.medioPago,
      estadoPago: params.estadoPago,
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
    this.assertEventoModificable(evento);

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
    this.assertEventoModificable(evento);
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
    totalRecuperado: number;
    totalGastado: number;
    totalPendienteReembolso: number;
    balance: number;
  }> {
    const evento = await this.findOne(eventoId);

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

    // Recupero del costo (solo destino cuentas_personales): INGRESO a la caja
    // grupo que devuelve el costo de lo vendido. Se reporta aparte y NO debe
    // contarse como ganancia.
    const totalRecuperado = this.sumMontos(
      movimientos,
      (m) =>
        m.tipo === TipoMovimiento.INGRESO &&
        m.concepto === ConceptoMovimiento.EVENTO_VENTA_RECUPERO_COSTO,
    );

    // Ganancia: ingresos de tipo INGRESO excluyendo el recupero de costo.
    // Cubre tanto VENTA (EVENTO_VENTA_INGRESO = margen) como GRUPO
    // (EVENTO_GRUPO_INGRESO = ingreso real); en ambos el recupero queda fuera.
    const gananciaVentas = this.sumMontos(
      movimientos,
      (m) =>
        m.tipo === TipoMovimiento.INGRESO &&
        m.concepto !== ConceptoMovimiento.EVENTO_VENTA_RECUPERO_COSTO,
    );

    const totalGastado = this.sumMontos(
      movimientos,
      (m) =>
        m.tipo === TipoMovimiento.EGRESO && m.estadoPago === EstadoPago.PAGADO,
    );

    const totalPendienteReembolso = this.sumMontos(
      movimientos,
      (m) =>
        m.tipo === TipoMovimiento.EGRESO &&
        m.estadoPago === EstadoPago.PENDIENTE_REEMBOLSO,
    );

    // Balance (resultado del evento), evitando la "resta doble":
    //  - VENTA: el ingreso registrado YA es la ganancia (precioVenta − precioCosto),
    //    o sea el costo nominal ya está descontado. Si restáramos los egresos reales
    //    a la ganancia, el costo se restaría dos veces. El neto correcto es
    //    recaudación bruta − egresos reales.
    //  - GRUPO: no hay productos; los ingresos son reales (no ganancia neta de costo),
    //    así que el neto es ingresos − egresos.
    // En ambos casos se restan SOLO los egresos PAGADOS: los pendientes de reembolso
    // todavía no impactan el balance (lo harán cuando pasen a PAGADO).
    const ingresoReal =
      evento.tipo === TipoEvento.VENTA ? totalRecaudado : gananciaVentas;

    return {
      totalRecaudado,
      gananciaVentas,
      totalRecuperado,
      totalGastado,
      totalPendienteReembolso,
      balance: ingresoReal - totalGastado,
    };
  }

  /** Suma el `monto` de los movimientos que cumplen el predicado. */
  private sumMontos(
    movimientos: Movimiento[],
    predicate: (m: Movimiento) => boolean,
  ): number {
    return movimientos
      .filter(predicate)
      .reduce((sum, m) => sum + Number(m.monto), 0);
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
