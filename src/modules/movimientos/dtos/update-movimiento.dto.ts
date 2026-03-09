import {
  IsString,
  IsEnum,
  IsNumber,
  IsDate,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsPositive,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MedioPago, EstadoPago } from '../../../common/enums';

export class UpdateMovimientoDto {
  @ApiPropertyOptional({ example: 2000.0, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  monto?: number;

  @ApiPropertyOptional({ example: 'Descripción actualizada', maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({ enum: MedioPago, example: MedioPago.TRANSFERENCIA })
  @IsEnum(MedioPago)
  @IsOptional()
  medioPago?: MedioPago;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  requiereComprobante?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  comprobanteEntregado?: boolean;

  @ApiPropertyOptional({ enum: EstadoPago, example: EstadoPago.PAGADO })
  @IsEnum(EstadoPago)
  @IsOptional()
  estadoPago?: EstadoPago;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  personaAReembolsarId?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fecha?: Date;
}
