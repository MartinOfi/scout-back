import { IsEnum, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Rama } from '../../../common/enums';

export class DeudaQueryDto {
  @ApiPropertyOptional({ enum: Rama, description: 'Filtrar por rama' })
  @IsOptional()
  @IsEnum(Rama)
  rama?: Rama;

  @ApiPropertyOptional({ description: 'Filtrar por año (ej: 2024)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano?: number;
}
