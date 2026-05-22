import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EntregaLineaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productoId!: string;

  @ApiProperty({ example: 'Locro' })
  productoNombre!: string;

  @ApiProperty({ example: 4, minimum: 1 })
  cantidad!: number;
}

export class EntregaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  eventoId!: string;

  @ApiProperty({ format: 'uuid' })
  vendedorId!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  vendedorNombre!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  fecha!: Date | null;

  @ApiPropertyOptional({ example: 'Retiró María 18:30', nullable: true })
  notas!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: [EntregaLineaResponseDto] })
  lineas!: EntregaLineaResponseDto[];
}
