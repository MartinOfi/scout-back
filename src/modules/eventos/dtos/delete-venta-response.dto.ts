import { ApiProperty } from '@nestjs/swagger';

/**
 * Response payload for DELETE /eventos/:eventoId/ventas/:ventaId.
 *
 * Mirrors VentasEventoService.deleteVenta's return shape so the controller
 * is a thin pass-through.
 */
export class DeleteVentaResponseDto {
  @ApiProperty({
    description: 'ID de la venta eliminada',
    format: 'uuid',
  })
  ventaId!: string;

  @ApiProperty({
    description:
      'ID del movimiento financiero asociado que también fue eliminado en cascada. ' +
      'Es null si la venta no tenía movimiento ligado (ventas legacy pre-backfill).',
    format: 'uuid',
    nullable: true,
  })
  movimientoIdEliminado!: string | null;

  @ApiProperty({
    description:
      'Cantidad de ventas hermanas (del mismo lote) que también fueron eliminadas en cascada. ' +
      '0 si la venta era individual o estaba sola en su movimiento.',
    minimum: 0,
  })
  hermanasEliminadas!: number;
}
