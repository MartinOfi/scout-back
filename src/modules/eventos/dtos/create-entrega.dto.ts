import {
  IsArray,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EntregaItemDto {
  @ApiProperty({
    description: 'ID del producto que se está entregando',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID()
  productoId!: string;

  @ApiProperty({
    description: 'Cantidad entregada de este producto',
    example: 4,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  cantidad!: number;
}

export class CreateEntregaDto {
  @ApiProperty({
    description:
      'ID del vendedor cuyos productos se están retirando (no necesariamente quien retira)',
    example: '550e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
  })
  @IsUUID()
  vendedorId!: string;

  @ApiPropertyOptional({
    description:
      'Fecha y hora en que se realizó la entrega. Si se omite, queda null.',
    example: '2026-05-22T18:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @ApiPropertyOptional({
    description:
      'Notas libres sobre la entrega (ej: quién retiró, hora, observaciones)',
    example: 'Retiró María 18:30',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

  @ApiProperty({
    description:
      'Productos entregados con sus cantidades. No se admiten productos duplicados.',
    type: [EntregaItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntregaItemDto)
  items!: EntregaItemDto[];
}
