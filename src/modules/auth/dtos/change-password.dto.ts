import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for changing user password
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: 'Contraseña actual del usuario',
    example: 'CurrentPass123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, {
    message: 'Contraseña actual debe tener al menos 8 caracteres',
  })
  @MaxLength(128, {
    message: 'Contraseña actual no puede exceder 128 caracteres',
  })
  currentPassword!: string;

  @ApiProperty({
    description: 'Nueva contraseña del usuario',
    example: 'NewSecurePass456',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, {
    message: 'Nueva contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(128, {
    message: 'Nueva contraseña no puede exceder 128 caracteres',
  })
  newPassword!: string;
}
