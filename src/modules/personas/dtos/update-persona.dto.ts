import {
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Rama, EstadoPersona, CargoEducador } from '../../../common/enums';

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

  @ApiPropertyOptional({
    enum: CargoEducador,
    example: CargoEducador.EDUCADOR,
    description: 'Cargo del educador en el grupo',
  })
  @IsEnum(CargoEducador)
  @IsOptional()
  cargo?: CargoEducador;

  @ApiPropertyOptional({ example: '11-5555-6666', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  contacto?: string;

  @ApiPropertyOptional({ example: 'Notas actualizadas' })
  @IsString()
  @IsOptional()
  notas?: string;

  // =========================================================================
  // Documentación entregada (solo para Protagonistas)
  // =========================================================================

  @ApiPropertyOptional({
    example: true,
    description: 'Partida de nacimiento entregada',
  })
  @IsBoolean()
  @IsOptional()
  partidaNacimiento?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'DNI entregado',
  })
  @IsBoolean()
  @IsOptional()
  dni?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'DNI de los padres entregado',
  })
  @IsBoolean()
  @IsOptional()
  dniPadres?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Carnet de obra social entregado',
  })
  @IsBoolean()
  @IsOptional()
  carnetObraSocial?: boolean;
}
