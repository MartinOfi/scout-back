import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rama } from '../../../common/enums';

export class CreateEducadorDto {
  @ApiProperty({ example: 'María García', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @ApiPropertyOptional({
    enum: Rama,
    example: Rama.UNIDAD,
    description: 'Rama asociada (opcional)',
  })
  @IsEnum(Rama)
  @IsOptional()
  rama?: Rama;
}
