import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rama, CargoEducador } from '../../../common/enums';

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

  @ApiProperty({
    enum: CargoEducador,
    example: CargoEducador.EDUCADOR,
    description: 'Cargo del educador en el grupo',
  })
  @IsEnum(CargoEducador)
  cargo!: CargoEducador;

  @ApiPropertyOptional({
    example: 'maria@scouts.org',
    description:
      'Email del educador. Requerido si se proporciona contraseña, y viceversa.',
  })
  @ValidateIf(
    (o: CreateEducadorDto) => o.email !== undefined || o.password !== undefined,
  )
  @IsNotEmpty({
    message: 'El email es requerido cuando se proporciona contraseña',
  })
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'contraseña123',
    description:
      'Contraseña del educador (mínimo 8 caracteres). Requerida si se proporciona email, y viceversa.',
    minLength: 8,
  })
  @ValidateIf(
    (o: CreateEducadorDto) => o.email !== undefined || o.password !== undefined,
  )
  @IsNotEmpty({
    message: 'La contraseña es requerida cuando se proporciona email',
  })
  @IsString()
  @MinLength(8)
  password?: string;
}
