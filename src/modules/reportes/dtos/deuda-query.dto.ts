import { IsEnum, IsIn, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  DEUDA_RAMA_FILTERS,
  RAMA_EDUCADORES,
  TipoDeudaFilter,
} from '../constants/deuda.constants';
import type { DeudaRamaFilter } from '../constants/deuda.constants';

export class DeudaQueryDto {
  @ApiPropertyOptional({
    enum: DEUDA_RAMA_FILTERS,
    description: `Filtrar por rama. "${RAMA_EDUCADORES}" devuelve solo educadores`,
  })
  @IsOptional()
  @IsIn(DEUDA_RAMA_FILTERS)
  rama?: DeudaRamaFilter;

  @ApiPropertyOptional({
    enum: TipoDeudaFilter,
    description:
      'Filtrar por tipo de deuda. "dinero" unifica toda la deuda monetaria',
  })
  @IsOptional()
  @IsEnum(TipoDeudaFilter)
  tipo?: TipoDeudaFilter;

  @ApiPropertyOptional({ description: 'Filtrar por año (ej: 2024)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano?: number;
}
