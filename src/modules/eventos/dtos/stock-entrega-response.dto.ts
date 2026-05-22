import { ApiProperty } from '@nestjs/swagger';

/**
 * One row of the stock-disponible report: how many units of a given
 * product, sold by a given vendor in this event, are still available
 * to deliver.
 *
 *   cantidadDisponible = cantidadVendida - cantidadEntregada
 */
export class StockEntregaResponseDto {
  @ApiProperty({ format: 'uuid' })
  productoId!: string;

  @ApiProperty({ example: 'Locro' })
  productoNombre!: string;

  @ApiProperty({ format: 'uuid' })
  vendedorId!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  vendedorNombre!: string;

  @ApiProperty({ example: 10, minimum: 0 })
  cantidadVendida!: number;

  @ApiProperty({ example: 4, minimum: 0 })
  cantidadEntregada!: number;

  @ApiProperty({ example: 6, minimum: 0 })
  cantidadDisponible!: number;
}
