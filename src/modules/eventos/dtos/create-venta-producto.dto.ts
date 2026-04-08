import { IsNumber, IsUUID, IsPositive, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MedioPago } from '../../../common/enums';

export class CreateVentaProductoDto {
  @ApiProperty({
    description: 'ID del evento donde se realiza la venta',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  eventoId!: string;

  @ApiProperty({
    description: 'ID del producto vendido',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID()
  productoId!: string;

  @ApiProperty({
    description: 'ID del vendedor (educador o protagonista)',
    example: '550e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
  })
  @IsUUID()
  vendedorId!: string;

  @ApiProperty({
    description: 'Cantidad de productos vendidos',
    example: 5,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  cantidad!: number;

  @ApiProperty({
    description: 'Medio de pago de la venta',
    enum: MedioPago,
    example: MedioPago.EFECTIVO,
  })
  @IsEnum(MedioPago)
  medioPago!: MedioPago;
}
