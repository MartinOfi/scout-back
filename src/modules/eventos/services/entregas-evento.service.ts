import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, In } from 'typeorm';
import { Entrega } from '../entities/entrega.entity';
import { EntregaLinea } from '../entities/entrega-linea.entity';
import { VentaProducto } from '../entities/venta-producto.entity';
import { Producto } from '../entities/producto.entity';
import { Evento } from '../entities/evento.entity';
import { Persona } from '../../personas/entities/persona.entity';
import { EventosService } from '../eventos.service';
import { PersonasService } from '../../personas/personas.service';
import {
  CreateEntregaDto,
  EntregaItemDto,
  EntregaResponseDto,
  StockEntregaResponseDto,
} from '../dtos';
import {
  ENTREGAS_ERROR_MESSAGES,
  PRODUCTOS_ERROR_MESSAGES,
} from '../constants';
import { escapeLikePattern } from '../../../common/utils';

interface StockKey {
  productoId: string;
  vendedorId: string;
}

interface StockTotals {
  vendida: number;
  entregada: number;
}

@Injectable()
export class EntregasEventoService {
  constructor(
    @InjectRepository(Entrega)
    private readonly entregaRepository: Repository<Entrega>,
    @InjectRepository(EntregaLinea)
    private readonly entregaLineaRepository: Repository<EntregaLinea>,
    @InjectRepository(VentaProducto)
    private readonly ventaProductoRepository: Repository<VentaProducto>,
    @InjectRepository(Producto)
    private readonly productoRepository: Repository<Producto>,
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    private readonly eventosService: EventosService,
    private readonly personasService: PersonasService,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== CREATE ====================

  /**
   * Registers a new entrega (header + lines) in a single transaction.
   *
   * Validates, in order:
   *  - Evento exists and is modificable (not closed).
   *  - Vendedor exists.
   *  - Items array has no duplicated productoId (rejected outright to keep
   *    stock validation simple — clients should aggregate cantidades).
   *  - Each productoId belongs to the evento.
   *  - For each (productoId, vendedorId) the vendedor has at least one
   *    VentaProducto in the evento.
   *  - For each item, cantidadVendida - cantidadEntregada >= cantidad.
   *
   * Stock validation runs inside the transaction (READ COMMITTED). No
   * pessimistic lock: race conditions are tolerated since in practice a
   * single operator records entregas at the event.
   */
  async crearEntrega(
    eventoId: string,
    dto: CreateEntregaDto,
    registradoPorId?: string,
  ): Promise<EntregaResponseDto> {
    const evento = await this.eventosService.findOne(eventoId);
    this.eventosService.assertEventoModificable(evento);

    const vendedor = await this.personasService.findOne(dto.vendedorId);

    // Cheap, pure-input validation: no DB. Lives outside the tx on purpose.
    this.assertNoDuplicateItems(dto.items);

    // Everything that touches DB rows that could change between reads —
    // productos, ventas SUM, entregas SUM — runs inside the same tx.
    return this.dataSource.transaction((manager) =>
      this.persistEntrega(
        manager,
        evento,
        vendedor,
        dto,
        registradoPorId ?? null,
      ),
    );
  }

  // ==================== READ ====================

  async findByEvento(
    eventoId: string,
    vendedorNombreFilter?: string,
  ): Promise<EntregaResponseDto[]> {
    await this.eventosService.findOne(eventoId);

    const qb = this.entregaRepository
      .createQueryBuilder('entrega')
      .leftJoinAndSelect('entrega.vendedor', 'vendedor')
      // Filter soft-deleted lines explicitly. Today lines only die with the
      // header, but if a future feature ever deletes lines independently we
      // don't want to leak them through this GET.
      .leftJoinAndSelect(
        'entrega.lineas',
        'lineas',
        'lineas."deletedAt" IS NULL',
      )
      .leftJoinAndSelect('lineas.producto', 'producto')
      .where('entrega.evento_id = :eventoId', { eventoId })
      .andWhere('entrega."deletedAt" IS NULL')
      .orderBy('entrega."createdAt"', 'DESC');

    const trimmed = vendedorNombreFilter?.trim();
    if (trimmed) {
      qb.andWhere('vendedor.nombre ILIKE :nombre', {
        nombre: `%${escapeLikePattern(trimmed)}%`,
      });
    }

    const entregas = await qb.getMany();
    return entregas.map((entrega) => this.toResponse(entrega));
  }

  async findOne(
    eventoId: string,
    entregaId: string,
  ): Promise<EntregaResponseDto> {
    await this.eventosService.findOne(eventoId);
    const entrega = await this.loadEntregaOrFail(eventoId, entregaId);
    return this.toResponse(entrega);
  }

  /**
   * Aggregated stock per (producto, vendedor) for an evento.
   *
   *   vendida    = SUM(VentaProducto.cantidad) WHERE deletedAt IS NULL
   *   entregada  = SUM(EntregaLinea.cantidad)  WHERE deletedAt IS NULL
   *                                              AND entrega.deletedAt IS NULL
   *   disponible = vendida - entregada
   *
   * The optional `vendedorNombreFilter` filters by vendor name AFTER
   * aggregation, since the join would otherwise multiply rows.
   */
  async getStockDisponible(
    eventoId: string,
    vendedorNombreFilter?: string,
  ): Promise<StockEntregaResponseDto[]> {
    await this.eventosService.findOne(eventoId);

    const ventas = await this.ventaProductoRepository
      .createQueryBuilder('v')
      .select('v.producto_id', 'productoId')
      .addSelect('v.vendedor_id', 'vendedorId')
      .addSelect('SUM(v.cantidad)', 'cantidadVendida')
      .where('v.evento_id = :eventoId', { eventoId })
      .andWhere('v."deletedAt" IS NULL')
      .groupBy('v.producto_id')
      .addGroupBy('v.vendedor_id')
      .getRawMany<{
        productoId: string;
        vendedorId: string;
        cantidadVendida: string;
      }>();

    const entregas = await this.entregaLineaRepository
      .createQueryBuilder('el')
      .innerJoin('el.entrega', 'e')
      .select('el.producto_id', 'productoId')
      .addSelect('e.vendedor_id', 'vendedorId')
      .addSelect('SUM(el.cantidad)', 'cantidadEntregada')
      .where('e.evento_id = :eventoId', { eventoId })
      .andWhere('el."deletedAt" IS NULL')
      .andWhere('e."deletedAt" IS NULL')
      .groupBy('el.producto_id')
      .addGroupBy('e.vendedor_id')
      .getRawMany<{
        productoId: string;
        vendedorId: string;
        cantidadEntregada: string;
      }>();

    const entregadasByKey = new Map<string, number>();
    for (const row of entregas) {
      entregadasByKey.set(
        this.stockKey({
          productoId: row.productoId,
          vendedorId: row.vendedorId,
        }),
        Number(row.cantidadEntregada),
      );
    }

    const productoIds = Array.from(new Set(ventas.map((v) => v.productoId)));
    const vendedorIds = Array.from(new Set(ventas.map((v) => v.vendedorId)));
    const [productos, vendedores] = await Promise.all([
      this.loadProductosByIds(productoIds),
      this.loadPersonasByIds(vendedorIds),
    ]);

    const filtroVendedor = vendedorNombreFilter?.trim().toLowerCase();

    const rows: StockEntregaResponseDto[] = ventas
      .map((v) => {
        const producto = productos.get(v.productoId);
        const vendedor = vendedores.get(v.vendedorId);
        const cantidadVendida = Number(v.cantidadVendida);
        const cantidadEntregada =
          entregadasByKey.get(
            this.stockKey({
              productoId: v.productoId,
              vendedorId: v.vendedorId,
            }),
          ) ?? 0;

        return {
          productoId: v.productoId,
          productoNombre: producto?.nombre ?? '',
          vendedorId: v.vendedorId,
          vendedorNombre: vendedor?.nombre ?? '',
          cantidadVendida,
          cantidadEntregada,
          cantidadDisponible: cantidadVendida - cantidadEntregada,
        };
      })
      .filter((row) => {
        if (!filtroVendedor) return true;
        return row.vendedorNombre.toLowerCase().includes(filtroVendedor);
      })
      .sort((a, b) => {
        const vendedorCmp = a.vendedorNombre.localeCompare(b.vendedorNombre);
        if (vendedorCmp !== 0) return vendedorCmp;
        return a.productoNombre.localeCompare(b.productoNombre);
      });

    return rows;
  }

  // ==================== DELETE ====================

  async deleteEntrega(eventoId: string, entregaId: string): Promise<void> {
    const evento = await this.eventosService.findOne(eventoId);
    this.eventosService.assertEventoModificable(evento);

    const entrega = await this.loadEntregaOrFail(eventoId, entregaId);

    await this.dataSource.transaction(async (manager) => {
      if (entrega.lineas.length > 0) {
        await manager.softRemove(entrega.lineas);
      }
      await manager.softRemove(entrega);
    });
  }

  // ==================== PRIVATE: VALIDATION ====================

  private assertNoDuplicateItems(items: EntregaItemDto[]): void {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.productoId)) {
        throw new BadRequestException(
          ENTREGAS_ERROR_MESSAGES.DUPLICATE_PRODUCTO_IN_ITEMS,
        );
      }
      seen.add(item.productoId);
    }
  }

  private assertItemsBelongToEvento(
    items: EntregaItemDto[],
    productosByEvento: Map<string, Producto>,
  ): void {
    for (const item of items) {
      if (!productosByEvento.has(item.productoId)) {
        throw new BadRequestException(
          PRODUCTOS_ERROR_MESSAGES.PRODUCTO_NOT_FOUND_IN_EVENTO(
            item.productoId,
          ),
        );
      }
    }
  }

  /**
   * Returns the stock map for the (vendedor, productosIds) on this evento,
   * keyed by productoId.
   */
  private async computeStockTotals(
    manager: EntityManager,
    eventoId: string,
    vendedorId: string,
    productoIds: string[],
  ): Promise<Map<string, StockTotals>> {
    const totals = new Map<string, StockTotals>();
    for (const productoId of productoIds) {
      totals.set(productoId, { vendida: 0, entregada: 0 });
    }

    const ventas = await manager
      .createQueryBuilder(VentaProducto, 'v')
      .select('v.producto_id', 'productoId')
      .addSelect('SUM(v.cantidad)', 'cantidadVendida')
      .where('v.evento_id = :eventoId', { eventoId })
      .andWhere('v.vendedor_id = :vendedorId', { vendedorId })
      .andWhere('v.producto_id IN (:...productoIds)', { productoIds })
      .andWhere('v."deletedAt" IS NULL')
      .groupBy('v.producto_id')
      .getRawMany<{ productoId: string; cantidadVendida: string }>();

    for (const row of ventas) {
      const totals_ = totals.get(row.productoId);
      if (totals_) totals_.vendida = Number(row.cantidadVendida);
    }

    const entregas = await manager
      .createQueryBuilder(EntregaLinea, 'el')
      .innerJoin('el.entrega', 'e')
      .select('el.producto_id', 'productoId')
      .addSelect('SUM(el.cantidad)', 'cantidadEntregada')
      .where('e.evento_id = :eventoId', { eventoId })
      .andWhere('e.vendedor_id = :vendedorId', { vendedorId })
      .andWhere('el.producto_id IN (:...productoIds)', { productoIds })
      .andWhere('el."deletedAt" IS NULL')
      .andWhere('e."deletedAt" IS NULL')
      .groupBy('el.producto_id')
      .getRawMany<{ productoId: string; cantidadEntregada: string }>();

    for (const row of entregas) {
      const totals_ = totals.get(row.productoId);
      if (totals_) totals_.entregada = Number(row.cantidadEntregada);
    }

    return totals;
  }

  // ==================== PRIVATE: LOADERS ====================

  /**
   * Same as `loadProductosOfEvento` but uses the transactional EntityManager
   * so the read participates in the surrounding transaction's isolation.
   */
  private async loadProductosOfEventoTx(
    manager: EntityManager,
    eventoId: string,
  ): Promise<Map<string, Producto>> {
    const productos = await manager.find(Producto, { where: { eventoId } });
    return new Map(productos.map((p) => [p.id, p]));
  }

  private async loadProductosByIds(
    ids: string[],
  ): Promise<Map<string, Producto>> {
    if (ids.length === 0) return new Map();
    const productos = await this.productoRepository.find({
      where: { id: In(ids) },
    });
    return new Map(productos.map((p) => [p.id, p]));
  }

  private async loadPersonasByIds(
    ids: string[],
  ): Promise<Map<string, Persona>> {
    if (ids.length === 0) return new Map();
    const personas = await this.personaRepository.find({
      where: { id: In(ids) },
    });
    return new Map(personas.map((p) => [p.id, p]));
  }

  private async loadEntregaOrFail(
    eventoId: string,
    entregaId: string,
  ): Promise<Entrega> {
    // `withDeleted: true` lets us distinguish "never existed / wrong evento"
    // (→ 404) from "soft-deleted" (→ 409). Without it, TypeORM filters
    // soft-deleted rows automatically and we always reach the 404 branch,
    // never the conflict one — the second DELETE would silently look like
    // the first.
    const entrega = await this.entregaRepository.findOne({
      where: { id: entregaId },
      relations: ['vendedor', 'lineas', 'lineas.producto'],
      withDeleted: true,
    });
    if (!entrega || entrega.eventoId !== eventoId) {
      throw new NotFoundException(
        ENTREGAS_ERROR_MESSAGES.ENTREGA_NOT_FOUND(entregaId),
      );
    }
    if (entrega.deletedAt !== null) {
      throw new ConflictException(
        ENTREGAS_ERROR_MESSAGES.ENTREGA_ALREADY_DELETED,
      );
    }
    return entrega;
  }

  // ==================== PRIVATE: PERSISTENCE ====================

  private async persistEntrega(
    manager: EntityManager,
    evento: Evento,
    vendedor: Persona,
    dto: CreateEntregaDto,
    registradoPorId: string | null,
  ): Promise<EntregaResponseDto> {
    // Load productos inside the tx so a concurrent producto soft-delete
    // can't slip past `assertItemsBelongToEvento`.
    const productosByEvento = await this.loadProductosOfEventoTx(
      manager,
      evento.id,
    );
    this.assertItemsBelongToEvento(dto.items, productosByEvento);

    const productoIds = dto.items.map((item) => item.productoId);
    const stockTotals = await this.computeStockTotals(
      manager,
      evento.id,
      vendedor.id,
      productoIds,
    );

    this.assertStockSufficient(dto.items, stockTotals, productosByEvento);

    const entrega = manager.create(Entrega, {
      eventoId: evento.id,
      vendedorId: vendedor.id,
      fecha: dto.fecha ? new Date(dto.fecha) : null,
      notas: dto.notas ?? null,
      registradoPorId,
    });
    const savedEntrega = await manager.save(entrega);

    const lineas = dto.items.map((item) =>
      manager.create(EntregaLinea, {
        entregaId: savedEntrega.id,
        productoId: item.productoId,
        cantidad: item.cantidad,
      }),
    );
    const savedLineas = await manager.save(lineas);

    return this.buildResponse(
      savedEntrega,
      vendedor,
      savedLineas,
      productosByEvento,
    );
  }

  private assertStockSufficient(
    items: EntregaItemDto[],
    stockTotals: Map<string, StockTotals>,
    productosByEvento: Map<string, Producto>,
  ): void {
    for (const item of items) {
      const totals = stockTotals.get(item.productoId);
      const producto = productosByEvento.get(item.productoId);
      const productoNombre = producto?.nombre ?? item.productoId;

      if (!totals || totals.vendida === 0) {
        throw new BadRequestException(
          ENTREGAS_ERROR_MESSAGES.VENDEDOR_SIN_VENTAS_DEL_PRODUCTO(
            productoNombre,
          ),
        );
      }

      const disponible = totals.vendida - totals.entregada;
      if (disponible < item.cantidad) {
        throw new BadRequestException(
          ENTREGAS_ERROR_MESSAGES.STOCK_INSUFICIENTE(
            productoNombre,
            disponible,
            item.cantidad,
          ),
        );
      }
    }
  }

  // ==================== PRIVATE: MAPPERS ====================

  private buildResponse(
    entrega: Entrega,
    vendedor: Persona,
    lineas: EntregaLinea[],
    productosByEvento: Map<string, Producto>,
  ): EntregaResponseDto {
    return {
      id: entrega.id,
      eventoId: entrega.eventoId,
      vendedorId: entrega.vendedorId,
      vendedorNombre: vendedor.nombre,
      fecha: entrega.fecha,
      notas: entrega.notas,
      createdAt: entrega.createdAt,
      lineas: lineas.map((linea) => ({
        id: linea.id,
        productoId: linea.productoId,
        productoNombre: productosByEvento.get(linea.productoId)?.nombre ?? '',
        cantidad: linea.cantidad,
      })),
    };
  }

  private toResponse(entrega: Entrega): EntregaResponseDto {
    return {
      id: entrega.id,
      eventoId: entrega.eventoId,
      vendedorId: entrega.vendedorId,
      vendedorNombre: entrega.vendedor?.nombre ?? '',
      fecha: entrega.fecha,
      notas: entrega.notas,
      createdAt: entrega.createdAt,
      lineas: (entrega.lineas ?? []).map((linea) => ({
        id: linea.id,
        productoId: linea.productoId,
        productoNombre: linea.producto?.nombre ?? '',
        cantidad: linea.cantidad,
      })),
    };
  }

  private stockKey(key: StockKey): string {
    return `${key.productoId}::${key.vendedorId}`;
  }
}
