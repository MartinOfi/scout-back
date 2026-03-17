import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsEnum, Min, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  TipoInscripcion,
  TipoDeuda,
  Rama,
  PersonaType,
} from '../../../common/enums';

/**
 * Valid values for rama filter
 * Includes scout branches (Rama enum) + 'educador' to filter only educators
 */
export const RAMA_FILTER_VALUES = [
  ...Object.values(Rama),
  PersonaType.EDUCADOR,
] as const;

export type RamaFilterValue = Rama | typeof PersonaType.EDUCADOR;

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
    enum: TipoDeuda,
    description:
      'Filtrar por tipo de deuda: documentacion (solo docs faltantes), dinero (solo saldo pendiente), ambos (dinero Y documentación). Si no se especifica con deudores=true, filtra cualquiera.',
    example: TipoDeuda.DINERO,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() as TipoDeuda;
    }
    return value;
  })
  @IsEnum(TipoDeuda)
  tipoDeuda?: TipoDeuda;

  @ApiPropertyOptional({
    enum: [...Object.values(Rama), PersonaType.EDUCADOR],
    description:
      'Filtrar por rama (Manada, Unidad, Caminantes, Rovers) o por educador. ' +
      'Al filtrar por rama, solo se muestran protagonistas de esa rama. ' +
      'Al filtrar por "educador", se muestran todos los educadores.',
    example: Rama.MANADA,
  })
  @IsOptional()
  @IsIn(RAMA_FILTER_VALUES)
  rama?: RamaFilterValue;
}
