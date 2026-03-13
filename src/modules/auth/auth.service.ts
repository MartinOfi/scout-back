import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Persona } from '../personas/entities/persona.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { AuthResponseDto, AuthUserDto } from './dtos/auth-response.dto';
import { EstadoPersona } from '../../common/enums';

/**
 * Authentication service handling login, registration, and token management
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Register credentials for an existing persona
   * Creates email/password for personas that don't have credentials yet
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // 1. Find persona
    const persona = await this.personaRepository.findOne({
      where: { id: dto.personaId, deletedAt: IsNull() },
    });

    if (!persona) {
      throw new NotFoundException('Persona no encontrada');
    }

    if (persona.estado !== EstadoPersona.ACTIVO) {
      throw new BadRequestException('Persona no está activa');
    }

    if (persona.email) {
      throw new ConflictException('Persona ya tiene credenciales registradas');
    }

    // 2. Check email uniqueness
    const existingEmail = await this.personaRepository.findOne({
      where: { email: dto.email, deletedAt: IsNull() },
    });

    if (existingEmail) {
      throw new ConflictException('Email ya está en uso');
    }

    // 3. Hash password and update persona
    const passwordHash = await this.passwordService.hash(dto.password);

    await this.personaRepository.update(persona.id, {
      email: dto.email,
      passwordHash,
    });

    // 4. Return updated persona with tokens
    const updatedPersona = { ...persona, email: dto.email };
    return this.generateAuthResponse(updatedPersona);
  }

  /**
   * Authenticate user with email and password
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // 1. Find persona by email (include passwordHash which is excluded by default)
    const persona = await this.personaRepository
      .createQueryBuilder('persona')
      .addSelect('persona.passwordHash')
      .where('persona.email = :email', { email: dto.email })
      .andWhere('persona.deletedAt IS NULL')
      .getOne();

    if (!persona || !persona.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (persona.estado !== EstadoPersona.ACTIVO) {
      throw new UnauthorizedException('Cuenta inactiva');
    }

    // 2. Verify password
    const isPasswordValid = await this.passwordService.compare(
      dto.password,
      persona.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generate tokens
    return this.generateAuthResponse(persona, ipAddress, userAgent);
  }

  /**
   * Refresh access token using a valid refresh token
   * Implements token rotation: old token is revoked, new one is issued
   */
  async refresh(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // 1. Verify token signature (validates format and expiration)
    try {
      this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Token de refresco inválido');
    }

    // 2. Find token in database
    const tokenHash = this.passwordService.hashToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash, revoked: false, deletedAt: IsNull() },
      relations: ['persona'],
    });

    if (!storedToken) {
      throw new UnauthorizedException('Token de refresco no válido');
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Token de refresco expirado');
    }

    // 3. Revoke old token (rotation)
    await this.refreshTokenRepository.update(storedToken.id, {
      revoked: true,
      revokedAt: new Date(),
    });

    // 4. Generate new tokens
    return this.generateAuthResponse(storedToken.persona, ipAddress, userAgent);
  }

  /**
   * Logout user by revoking their refresh token
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific token
      const tokenHash = this.passwordService.hashToken(refreshToken);
      await this.refreshTokenRepository.update(
        { tokenHash, personaId: userId },
        { revoked: true, revokedAt: new Date() },
      );
    } else {
      // Revoke all tokens for user
      await this.refreshTokenRepository.update(
        { personaId: userId, revoked: false },
        { revoked: true, revokedAt: new Date() },
      );
    }
  }

  /**
   * Change password for authenticated user
   * Verifies current password before updating
   * Revokes all existing refresh tokens for security
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    // 1. Get persona with password hash
    const persona = await this.personaRepository
      .createQueryBuilder('persona')
      .addSelect('persona.passwordHash')
      .where('persona.id = :id', { id: userId })
      .andWhere('persona.deletedAt IS NULL')
      .getOne();

    if (!persona || !persona.passwordHash) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // 2. Verify current password
    const isCurrentPasswordValid = await this.passwordService.compare(
      dto.currentPassword,
      persona.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    // 3. Ensure new password is different
    const isSamePassword = await this.passwordService.compare(
      dto.newPassword,
      persona.passwordHash,
    );

    if (isSamePassword) {
      throw new BadRequestException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    // 4. Hash and update new password
    const newPasswordHash = await this.passwordService.hash(dto.newPassword);
    await this.personaRepository.update(userId, {
      passwordHash: newPasswordHash,
    });

    // 5. Revoke all refresh tokens for security
    await this.refreshTokenRepository.update(
      { personaId: userId, revoked: false },
      { revoked: true, revokedAt: new Date() },
    );
  }

  /**
   * Generate auth response with access and refresh tokens
   */
  private async generateAuthResponse(
    persona: Persona,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    // 1. Create refresh token entity (need ID for JWT payload)
    const expiresAt = new Date(
      Date.now() + this.tokenService.getRefreshTokenExpirationMs(),
    );

    const refreshTokenEntity = this.refreshTokenRepository.create({
      personaId: persona.id,
      tokenHash: '', // Placeholder, will update after generating JWT
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });

    const saved = await this.refreshTokenRepository.save(refreshTokenEntity);

    // 2. Generate tokens
    const accessToken = this.tokenService.generateAccessToken({
      sub: persona.id,
      email: persona.email!,
      tipo: persona.tipo,
    });

    const refreshToken = this.tokenService.generateRefreshToken({
      sub: persona.id,
      email: persona.email!,
      tipo: persona.tipo,
      tokenId: saved.id,
    });

    // 3. Update with actual token hash
    const tokenHash = this.passwordService.hashToken(refreshToken);
    await this.refreshTokenRepository.update(saved.id, { tokenHash });

    // 4. Build response
    const user: AuthUserDto = {
      id: persona.id,
      nombre: persona.nombre,
      email: persona.email!,
      tipo: persona.tipo,
    };

    return { accessToken, refreshToken, user };
  }
}
