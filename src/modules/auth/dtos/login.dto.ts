import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for user login
 */
export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'educador@scout.org',
  })
  @IsEmail({}, { message: 'Email debe ser un email válido' })
  email!: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'SecurePass123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'Contraseña no puede exceder 128 caracteres' })
  password!: string;
}
