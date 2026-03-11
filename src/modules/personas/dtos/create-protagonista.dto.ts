import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rama } from '../../../common/enums';

export class CreateProtagonistaDto {
  @ApiProperty({ example: 'Juan Pérez', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({ enum: Rama, example: Rama.MANADA })
  @IsEnum(Rama)
  rama!: Rama;

  // =========================================================================
  // Documentación entregada
  // =========================================================================

  @ApiPropertyOptional({
    example: false,
    description: 'Partida de nacimiento entregada (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  partidaNacimiento?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'DNI entregado (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  dni?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'DNI de los padres entregado (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  dniPadres?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Carnet de obra social entregado (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  carnetObraSocial?: boolean;
}
