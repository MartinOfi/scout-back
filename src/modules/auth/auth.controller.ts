import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { RefreshTokenDto } from './dtos/refresh-token.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { ChangeEmailDto } from './dtos/change-email.dto';
import { AuthResponseDto, AuthUserDto } from './dtos/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Persona } from '../personas/entities/persona.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @ApiOperation({
    summary: 'Registrar credenciales para una persona existente',
    description:
      'Asigna email y contraseña a una persona que no tiene credenciales aún',
  })
  @ApiResponse({
    status: 201,
    description: 'Credenciales registradas exitosamente',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Email ya en uso o persona ya tiene credenciales',
  })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña' })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renovar tokens con refresh token',
    description:
      'Obtiene nuevos access y refresh tokens usando el refresh token actual',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens renovados exitosamente',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    return this.authService.refresh(dto.refreshToken, ipAddress, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Revoca el refresh token actual o todos si no se especifica',
  })
  @ApiResponse({ status: 204, description: 'Sesión cerrada exitosamente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async logout(
    @CurrentUser() user: Persona,
    @Body() dto?: RefreshTokenDto,
  ): Promise<void> {
    await this.authService.logout(user.id, dto?.refreshToken);
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambiar contraseña',
    description:
      'Cambia la contraseña del usuario autenticado. Requiere la contraseña actual.',
  })
  @ApiResponse({ status: 204, description: 'Contraseña cambiada exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Nueva contraseña igual a la actual',
  })
  @ApiResponse({ status: 401, description: 'Contraseña actual incorrecta' })
  async changePassword(
    @CurrentUser() user: Persona,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto);
  }

  @Patch('email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambiar email',
    description:
      'Cambia el email del usuario autenticado. Requiere la contraseña actual.',
  })
  @ApiResponse({ status: 204, description: 'Email cambiado exitosamente' })
  @ApiResponse({ status: 400, description: 'Email igual al actual' })
  @ApiResponse({ status: 401, description: 'Contraseña actual incorrecta' })
  @ApiResponse({ status: 409, description: 'Email ya está en uso' })
  async changeEmail(
    @CurrentUser() user: Persona,
    @Body() dto: ChangeEmailDto,
  ): Promise<void> {
    await this.authService.changeEmail(user.id, dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener perfil del usuario actual',
    description: 'Retorna la información del usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario',
    type: AuthUserDto,
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getMe(@CurrentUser() user: Persona): AuthUserDto {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email!,
      tipo: user.tipo,
    };
  }
}
