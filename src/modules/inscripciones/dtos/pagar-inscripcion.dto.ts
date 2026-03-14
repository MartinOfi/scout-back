import { IsNumber, IsOptional, IsEnum, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedioPago } from '../../../common/enums';

export class PagarInscripcionDto {
  @ApiProperty({
    example: 5000.0,
    minimum: 0,
    description:
      'Monto pagado en efectivo/transferencia. NO incluye el monto de saldo personal.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  montoPagado!: number;

  @ApiPropertyOptional({
    example: 3000.0,
    minimum: 0,
    description:
      'Monto a descontar de la caja personal (default: 0). Independiente de montoPagado. Total = montoPagado + montoConSaldoPersonal.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoConSaldoPersonal?: number;

  @ApiPropertyOptional({
    enum: MedioPago,
    example: MedioPago.EFECTIVO,
    description:
      'Medio de pago para montoPagado (solo aplica si montoPagado > 0)',
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
