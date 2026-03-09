import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Rama, EstadoPersona } from '../../../common/enums';

export class UpdatePersonaDto {
  @ApiPropertyOptional({
    example: 'Juan Pérez Actualizado',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ enum: EstadoPersona, example: EstadoPersona.ACTIVO })
  @IsEnum(EstadoPersona)
  @IsOptional()
  estado?: EstadoPersona;

  @ApiPropertyOptional({ enum: Rama, example: Rama.UNIDAD })
  @IsEnum(Rama)
  @IsOptional()
  rama?: Rama;

  @ApiPropertyOptional({ example: '11-5555-6666', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  contacto?: string;

  @ApiPropertyOptional({ example: 'Notas actualizadas' })
  @IsString()
  @IsOptional()
  notas?: string;
}
