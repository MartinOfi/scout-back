import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsEnum, IsBoolean, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TipoInscripcion } from '../../../common/enums';

/**
 * Query parameters for GET /inscripciones endpoint
 */
export class GetInscripcionesQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por año',
    example: 2024,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  ano?: number;

  @ApiPropertyOptional({
    enum: TipoInscripcion,
    description: 'Filtrar por tipo de inscripción',
  })
  @IsOptional()
  @IsEnum(TipoInscripcion)
  tipo?: TipoInscripcion;

  @ApiPropertyOptional({
    description:
      'Si es true, filtra solo inscripciones con documentos faltantes o saldo pendiente',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  deudores?: boolean;
}
