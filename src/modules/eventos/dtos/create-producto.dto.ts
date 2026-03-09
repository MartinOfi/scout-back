import {
  IsString,
  IsNumber,
  IsUUID,
  IsPositive,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductoDto {
  @ApiProperty({
    description: 'ID del evento al que pertenece el producto',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  eventoId!: string;

  @ApiProperty({
    description: 'Nombre del producto',
    example: 'Empanada de carne',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({
    description: 'Precio de costo del producto',
    example: 150.0,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioCosto!: number;

  @ApiProperty({
    description: 'Precio de venta del producto',
    example: 300.0,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioVenta!: number;
}
