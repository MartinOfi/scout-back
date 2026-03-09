import { IsString, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}
