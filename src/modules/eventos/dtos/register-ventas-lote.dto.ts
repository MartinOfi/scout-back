import {
  IsArray,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VentaItemDto {
  @ApiProperty({
    description: 'ID del producto vendido',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID()
  productoId!: string;

  @ApiProperty({
    description: 'Cantidad vendida de este producto',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  cantidad!: number;
}

export class RegisterVentasLoteDto {
  @ApiProperty({
    description: 'ID del vendedor (educador o protagonista)',
    example: '550e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
  })
  @IsUUID()
  vendedorId!: string;

  @ApiProperty({
    description: 'Lista de productos vendidos con sus cantidades',
    type: [VentaItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VentaItemDto)
  items!: VentaItemDto[];
}
