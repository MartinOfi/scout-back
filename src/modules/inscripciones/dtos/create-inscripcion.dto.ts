import {
  IsNumber,
  IsUUID,
  IsPositive,
  IsEnum,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoInscripcion } from '../../../common/enums';

export class CreateInscripcionDto {
  @ApiProperty({ format: 'uuid', description: 'ID de la persona' })
  @IsUUID()
  personaId!: string;

  @ApiProperty({
    enum: TipoInscripcion,
    example: TipoInscripcion.GRUPO,
    description: 'Tipo de inscripción',
  })
  @IsEnum(TipoInscripcion)
  tipo!: TipoInscripcion;

  @ApiProperty({ example: 2026, minimum: 2020, maximum: 2100 })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  ano!: number;

  @ApiProperty({
    example: 15000.0,
    minimum: 0.01,
    description: 'Monto total de la inscripción',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoTotal!: number;

  @ApiPropertyOptional({
    example: 5000.0,
    minimum: 0,
    description: 'Monto bonificado (default: 0)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoBonificado?: number;
}
