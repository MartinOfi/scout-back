import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  DEUDA_RAMA_FILTERS,
  RAMA_EDUCADORES,
  TipoDeudaFilter,
} from '../constants/deuda.constants';
import type { DeudaRamaFilter } from '../constants/deuda.constants';

/** Largo máximo del texto de búsqueda por nombre. */
const MAX_BUSQUEDA_LENGTH = 100;

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

  @ApiPropertyOptional({
    description:
      'Texto a buscar en el nombre de la persona (sin distinguir mayúsculas ni tildes)',
    maxLength: MAX_BUSQUEDA_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MAX_BUSQUEDA_LENGTH)
  q?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Solo la deuda de este campamento (ver `campamentos` del consolidado)',
  })
  @IsOptional()
  @IsUUID()
  campamentoId?: string;
}
