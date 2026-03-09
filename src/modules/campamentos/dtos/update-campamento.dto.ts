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
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCampamentoDto {
  @ApiPropertyOptional({
    example: 'Campamento Actualizado',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fechaInicio?: Date;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fechaFin?: Date;

  @ApiPropertyOptional({ example: 30000.0, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @IsOptional()
  costoPorPersona?: number;

  @ApiPropertyOptional({ example: 4, minimum: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  cuotasBase?: number;

  @ApiPropertyOptional({ example: 'Descripción actualizada' })
  @IsString()
  @IsOptional()
  descripcion?: string;
}
