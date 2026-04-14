import {
  IsUUID,
  IsNumber,
  IsPositive,
  IsOptional,
  IsString,
  IsDate,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for transferring funds between two cajas.
 *
 * Creates two linked movimientos (egreso in origen, ingreso in destino)
 * atomically in a single transaction. Both share `movimientoRelacionadoId`.
 */
export class CreateTransferenciaDto {
  @ApiProperty({ format: 'uuid', description: 'Caja origen (donde sale la plata)' })
  @IsUUID()
  cajaOrigenId!: string;

  @ApiProperty({ format: 'uuid', description: 'Caja destino (donde entra la plata)' })
  @IsUUID()
  cajaDestinoId!: string;

  @ApiProperty({ example: 5000, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number;

  @ApiProperty({
    format: 'uuid',
    description: 'Persona que ejecuta y registra la transferencia',
  })
  @IsUUID()
  responsableId!: string;

  @ApiPropertyOptional({ example: 'Asignación mensual a fondo de Manada', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Fecha de la transferencia (default: fecha actual)',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fecha?: Date;
}
