import { ApiProperty } from '@nestjs/swagger';
import { PersonaType } from '../../../common/enums';

/**
 * User info returned in auth responses
 */
export class AuthUserDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'María García' })
  nombre!: string;

  @ApiProperty({ example: 'educador@scout.org' })
  email!: string;

  @ApiProperty({ enum: PersonaType, example: PersonaType.EDUCADOR })
  tipo!: PersonaType;
}

/**
 * Response DTO for successful authentication
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'JWT access token (short-lived)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'JWT refresh token (long-lived)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
