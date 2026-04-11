import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { VentaProducto } from '../entities/venta-producto.entity';
import { Evento } from '../entities/evento.entity';
import { EventosService } from '../eventos.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { VENTAS_ERROR_MESSAGES } from '../constants';

/**
 * Result of deleting a venta. Returned to the controller so callers can
 * tell the user honestly what happened (e.g. "we also removed N sibling
 * ventas from the same lote").
 */
export interface DeleteVentaResult {
  ventaId: string;
  movimientoIdEliminado: string | null;
  hermanasEliminadas: number;
}

/**
 * Service dedicated to the lifecycle of an individual venta.
 *
 * Currently exposes only the delete path. Create paths still live in
 * EventosService.registrarVenta / registrarVentasLote — they will move
 * here in a follow-up refactor; this service is the new home that
 * keeps eventos.service.ts from growing further.
 */
@Injectable()
export class VentasEventoService {
  constructor(
    @InjectRepository(VentaProducto)
    private readonly ventaProductoRepository: Repository<VentaProducto>,
    private readonly eventosService: EventosService,
    private readonly movimientosService: MovimientosService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Soft-deletes a venta and, if it was linked to a Movimiento, every
   * sibling venta that points at the same Movimiento, plus the Movimiento
   * itself. Atomic: a single transaction wraps the cascade.
   *
   * Errors:
   *  - NotFoundException if the venta does not exist or does not belong
   *    to the supplied evento (we don't leak existence cross-evento).
   *  - ConflictException if the venta is already soft-deleted.
   *  - BadRequestException if the parent evento is closed (raised by
   *    EventosService.assertEventoModificable).
   */
  async deleteVenta(
    eventoId: string,
    ventaId: string,
  ): Promise<DeleteVentaResult> {
    const evento = await this.eventosService.findOne(eventoId);
    this.eventosService.assertEventoModificable(evento);

    const venta = await this.loadVentaOrFail(eventoId, ventaId);

    return this.dataSource.transaction((manager) =>
      this.cascadeDeleteVenta(manager, evento, venta),
    );
  }

  // ----- private orchestration -----

  private async cascadeDeleteVenta(
    manager: EntityManager,
    evento: Evento,
    venta: VentaProducto,
  ): Promise<DeleteVentaResult> {
    if (!venta.movimientoId) {
      await manager.softRemove(venta);
      return this.buildResult(venta, null, 0);
    }

    const hermanas = await this.findLiveSiblings(
      manager,
      venta.movimientoId,
      venta.id,
    );
    const allVentas = [venta, ...hermanas];

    await manager.softRemove(allVentas);
    await this.movimientosService.softRemoveWithManager(
      manager,
      venta.movimientoId,
    );

    // Recalculate KPIs implicitly: nothing to do here. The transaction will
    // commit and EventosService.getKpisEvento(evento.id) is recomputed on
    // demand from the live rows.
    void evento;

    return this.buildResult(venta, venta.movimientoId, hermanas.length);
  }

  // ----- private loaders -----

  private async loadVentaOrFail(
    eventoId: string,
    ventaId: string,
  ): Promise<VentaProducto> {
    const venta = await this.ventaProductoRepository.findOne({
      where: { id: ventaId },
    });
    if (!venta || venta.eventoId !== eventoId) {
      throw new NotFoundException(
        VENTAS_ERROR_MESSAGES.VENTA_NOT_FOUND(ventaId),
      );
    }
    if (venta.deletedAt !== null) {
      throw new ConflictException(VENTAS_ERROR_MESSAGES.VENTA_ALREADY_DELETED);
    }
    return venta;
  }

  /**
   * Live siblings = other ventas (not soft-deleted) that share the same
   * movimiento_id but have a different id. Used to compute the cascade size.
   */
  private async findLiveSiblings(
    manager: EntityManager,
    movimientoId: string,
    excludeVentaId: string,
  ): Promise<VentaProducto[]> {
    return manager
      .createQueryBuilder(VentaProducto, 'v')
      .where('v.movimiento_id = :movimientoId', { movimientoId })
      .andWhere('v.id <> :excludeId', { excludeId: excludeVentaId })
      .andWhere('v."deletedAt" IS NULL')
      .getMany();
  }

  // ----- private builders -----

  private buildResult(
    venta: VentaProducto,
    movimientoIdEliminado: string | null,
    hermanasEliminadas: number,
  ): DeleteVentaResult {
    return {
      ventaId: venta.id,
      movimientoIdEliminado,
      hermanasEliminadas,
    };
  }
}
