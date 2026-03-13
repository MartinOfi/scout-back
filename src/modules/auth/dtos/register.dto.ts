import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for registering credentials to an existing persona
 */
export class RegisterDto {
  @ApiProperty({
    description:
      'ID de la persona existente a la que se asignarán credenciales',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID('4', { message: 'personaId debe ser un UUID válido' })
  personaId!: string;

  @ApiProperty({
    description: 'Email para el login',
    example: 'educador@scout.org',
  })
  @IsEmail({}, { message: 'Email debe ser un email válido' })
  email!: string;

  @ApiProperty({
    description:
      'Contraseña (min 8 chars, debe contener mayúscula, minúscula y número)',
    example: 'SecurePass123',
  })
  @IsString()
  @MinLength(8, { message: 'Contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'Contraseña no puede exceder 128 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Contraseña debe contener al menos una mayúscula, una minúscula y un número',
  })
  password!: string;
}
