import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CajaType } from '../../../common/enums';

/**
 * DTO for Caja response with calculated saldo
 */
export class CajaResponseDto {
  @ApiProperty({ description: 'UUID de la caja' })
  id!: string;

  @ApiProperty({ enum: CajaType, description: 'Tipo de caja' })
  tipo!: CajaType;

  @ApiPropertyOptional({ description: 'Nombre de la caja' })
  nombre!: string | null;

  @ApiPropertyOptional({
    description: 'ID del propietario (solo para tipo PERSONAL)',
  })
  propietarioId!: string | null;

  @ApiPropertyOptional({ description: 'Datos del propietario' })
  propietario!: {
    id: string;
    nombre: string;
  } | null;

  @ApiProperty({ description: 'Saldo actual calculado desde movimientos' })
  saldoActual!: number;

  @ApiProperty({ description: 'Fecha de creación' })
  createdAt!: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  updatedAt!: Date;
}
