import { ApiProperty } from '@nestjs/swagger';

/**
 * Entrada del historial de bonificaciones otorgadas por el fondo solidario.
 */
export class BonificacionHistorialDto {
  @ApiProperty() movimientoId!: string;
  @ApiProperty() fecha!: Date;
  @ApiProperty() monto!: number;
  @ApiProperty() personaId!: string;
  @ApiProperty() personaNombre!: string;
  @ApiProperty({ description: '"Campamento X" o "Inscripción <id>"' })
  destino!: string;
}
