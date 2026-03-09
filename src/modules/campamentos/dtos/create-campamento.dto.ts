import {
  IsString,
  IsNumber,
  IsDate,
  IsOptional,
  IsPositive,
  MinLength,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCampamentoDto {
  @ApiProperty({
    example: 'Campamento de Verano 2026',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({ example: '2026-01-15', type: String, format: 'date' })
  @IsDate()
  @Type(() => Date)
  fechaInicio!: Date;

  @ApiProperty({ example: '2026-01-22', type: String, format: 'date' })
  @IsDate()
  @Type(() => Date)
  fechaFin!: Date;

  @ApiProperty({
    example: 25000.0,
    minimum: 0.01,
    description: 'Costo por persona',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  costoPorPersona!: number;

  @ApiPropertyOptional({
    example: 3,
    minimum: 1,
    default: 1,
    description: 'Cantidad de cuotas sugeridas (informativo)',
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  cuotasBase?: number;

  @ApiPropertyOptional({ example: 'Campamento anual en Sierra de la Ventana' })
  @IsString()
  @IsOptional()
  descripcion?: string;
}
