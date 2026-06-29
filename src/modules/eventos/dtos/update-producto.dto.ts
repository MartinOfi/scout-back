import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating a producto (PATCH /eventos/productos/:productoId).
 *
 * Every field is optional so callers can patch just the cost once it is
 * known. precioCosto and precioVenta keep the same positive/decimal rules
 * as creation when present.
 */
export class UpdateProductoDto {
  @ApiPropertyOptional({
    description: 'Nombre del producto',
    example: 'Empanada de carne',
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Precio de costo del producto',
    example: 150.0,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioCosto?: number;

  @ApiPropertyOptional({
    description: 'Precio de venta del producto',
    example: 300.0,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  precioVenta?: number;
}
