import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for changing user email
 * Requires current password confirmation for security
 */
export class ChangeEmailDto {
  @ApiProperty({
    description: 'Nuevo email del usuario',
    example: 'nuevo@email.com',
  })
  @IsEmail({}, { message: 'El nuevo email debe ser un email válido' })
  newEmail!: string;

  @ApiProperty({
    description: 'Contraseña actual para confirmar la operación',
    example: 'CurrentPass123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, {
    message: 'Contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(128, {
    message: 'Contraseña no puede exceder 128 caracteres',
  })
  currentPassword!: string;
}
