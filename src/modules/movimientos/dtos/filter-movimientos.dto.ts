import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dtos';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  EstadoPago,
} from '../../../common/enums';

/**
 * DTO para filtrar movimientos con paginación
 */
export class FilterMovimientosDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de caja',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  cajaId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de movimiento',
    enum: TipoMovimiento,
  })
  @IsEnum(TipoMovimiento)
  @IsOptional()
  tipo?: TipoMovimiento;

  @ApiPropertyOptional({
    description: 'Filtrar por concepto',
    enum: ConceptoMovimiento,
  })
  @IsEnum(ConceptoMovimiento)
  @IsOptional()
  concepto?: ConceptoMovimiento;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del responsable',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  responsableId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de pago',
    enum: EstadoPago,
  })
  @IsEnum(EstadoPago)
  @IsOptional()
  estadoPago?: EstadoPago;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del rango (ISO 8601)',
    type: String,
    example: '2025-01-01',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  fechaInicio?: Date;

  @ApiPropertyOptional({
    description: 'Fecha de fin del rango (ISO 8601)',
    type: String,
    example: '2025-12-31',
  })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  fechaFin?: Date;
}
