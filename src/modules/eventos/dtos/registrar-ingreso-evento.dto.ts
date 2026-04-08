import { IsEnum, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MedioPago } from '../../../common/enums';

export class RegistrarIngresoEventoDto {
  @ApiProperty({ description: 'Monto del ingreso', example: 10000, minimum: 0 })
  @IsNumber()
  @Min(0)
  monto!: number;

  @ApiProperty({
    description: 'Descripción del ingreso',
    example: 'Venta de entradas',
  })
  @IsString()
  descripcion!: string;

  @ApiProperty({
    description: 'ID de la persona responsable del ingreso',
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
}
