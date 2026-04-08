import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPago, MedioPago } from '../../../common/enums';

export class RegistrarGastoEventoDto {
  @ApiProperty({ description: 'Monto del gasto', example: 5000, minimum: 0 })
  @IsNumber()
  @Min(0)
  monto!: number;

  @ApiProperty({
    description: 'Descripción del gasto',
    example: 'Compra de materiales',
  })
  @IsString()
  descripcion!: string;

  @ApiProperty({
    description: 'ID de la persona responsable del gasto',
    format: 'uuid',
  })
  @IsUUID()
  responsableId!: string;

  @ApiProperty({
    description: 'Medio de pago',
    enum: MedioPago,
    example: MedioPago.EFECTIVO,
  })
  @IsEnum(MedioPago)
  medioPago!: MedioPago;

  @ApiProperty({
    description: 'Estado del pago del gasto',
    enum: EstadoPago,
    example: EstadoPago.PAGADO,
  })
  @IsEnum(EstadoPago)
  estadoPago!: EstadoPago;

  @ApiPropertyOptional({
    description:
      'ID de la persona a reembolsar (requerido si estadoPago es PENDIENTE_REEMBOLSO)',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  personaAReembolsarId?: string;
}
