import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePersonaExternaDto {
  @ApiProperty({ example: 'Carlos Rodríguez', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @ApiPropertyOptional({ example: '11-4444-5555', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  contacto?: string;

  @ApiPropertyOptional({ example: 'Padre de Juan Pérez' })
  @IsString()
  @IsOptional()
  notas?: string;
}
