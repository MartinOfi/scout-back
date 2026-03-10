import {
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedioPago } from '../../../common/enums';

export class PagarInscripcionDto {
  @ApiProperty({
    example: 5000.0,
    minimum: 0.01,
    description: 'Monto total a pagar',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoPagado!: number;

  @ApiPropertyOptional({
    example: 3000.0,
    minimum: 0,
    description: 'Monto a descontar de la caja personal (default: 0)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoConSaldoPersonal?: number;

  @ApiPropertyOptional({
    enum: MedioPago,
    example: MedioPago.EFECTIVO,
    description:
      'Medio de pago para la parte no cubierta por saldo personal (default: efectivo)',
  })
  @IsEnum(MedioPago)
  @IsOptional()
  medioPago?: MedioPago;

  @ApiPropertyOptional({
    example: 'Pago parcial de inscripción',
    description: 'Descripción opcional del pago',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;
}
