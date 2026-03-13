import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Persona } from '../personas/entities/persona.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { PersonaType, EstadoPersona } from '../../common/enums';

describe('AuthService', () => {
  let service: AuthService;
  let personaRepository: jest.Mocked<Repository<Persona>>;
  let refreshTokenRepository: jest.Mocked<Repository<RefreshToken>>;
  let passwordService: jest.Mocked<PasswordService>;
  let tokenService: jest.Mocked<TokenService>;

  const mockPersona: Partial<Persona> = {
    id: 'persona-uuid-123',
    nombre: 'Test User',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    tipo: PersonaType.EDUCADOR,
    estado: EstadoPersona.ACTIVO,
    deletedAt: null,
  };

  const mockRefreshToken: Partial<RefreshToken> = {
    id: 'token-uuid-456',
    personaId: 'persona-uuid-123',
    tokenHash: 'hashed-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revoked: false,
    persona: mockPersona as Persona,
  };

  beforeEach(async () => {
    const mockPersonaRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockRefreshTokenRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const mockPasswordService = {
      hash: jest.fn(),
      compare: jest.fn(),
      hashToken: jest.fn(),
    };

    const mockTokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      getRefreshTokenExpirationMs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Persona), useValue: mockPersonaRepo },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    personaRepository = module.get(getRepositoryToken(Persona));
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    passwordService = module.get(PasswordService);
    tokenService = module.get(TokenService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      personaId: 'persona-uuid-123',
      email: 'new@example.com',
      password: 'Password123!',
    };

    it('should register credentials for an existing persona', async () => {
      const personaWithoutEmail = { ...mockPersona, email: null };
      personaRepository.findOne
        .mockResolvedValueOnce(personaWithoutEmail as Persona)
        .mockResolvedValueOnce(null);
      passwordService.hash.mockResolvedValue('hashed-password');
      personaRepository.update.mockResolvedValue({ affected: 1 } as any);
      tokenService.getRefreshTokenExpirationMs.mockReturnValue(
        7 * 24 * 60 * 60 * 1000,
      );
      refreshTokenRepository.create.mockReturnValue({
        id: 'new-token-id',
      } as RefreshToken);
      refreshTokenRepository.save.mockResolvedValue({
        id: 'new-token-id',
      } as RefreshToken);
      tokenService.generateAccessToken.mockReturnValue('access-token');
      tokenService.generateRefreshToken.mockReturnValue('refresh-token');
      passwordService.hashToken.mockReturnValue('hashed-refresh-token');
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.email).toBe('new@example.com');
      expect(passwordService.hash).toHaveBeenCalledWith('Password123!');
    });

    it('should throw NotFoundException when persona not found', async () => {
      personaRepository.findOne.mockResolvedValue(null);

      await expect(service.register(registerDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when persona is inactive', async () => {
      const inactivePersona = {
        ...mockPersona,
        email: null,
        estado: EstadoPersona.INACTIVO,
      };
      personaRepository.findOne.mockResolvedValue(inactivePersona as Persona);

      await expect(service.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when persona already has credentials', async () => {
      personaRepository.findOne.mockResolvedValue(mockPersona as Persona);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when email is already in use', async () => {
      const personaWithoutEmail = { ...mockPersona, email: null };
      personaRepository.findOne
        .mockResolvedValueOnce(personaWithoutEmail as Persona)
        .mockResolvedValueOnce(mockPersona as Persona);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const setupQueryBuilder = (persona: Partial<Persona> | null) => {
      const queryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(persona),
      };
      personaRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
      return queryBuilder;
    };

    it('should login with valid credentials', async () => {
      setupQueryBuilder(mockPersona);
      passwordService.compare.mockResolvedValue(true);
      tokenService.getRefreshTokenExpirationMs.mockReturnValue(
        7 * 24 * 60 * 60 * 1000,
      );
      refreshTokenRepository.create.mockReturnValue({
        id: 'token-id',
      } as RefreshToken);
      refreshTokenRepository.save.mockResolvedValue({
        id: 'token-id',
      } as RefreshToken);
      tokenService.generateAccessToken.mockReturnValue('access-token');
      tokenService.generateRefreshToken.mockReturnValue('refresh-token');
      passwordService.hashToken.mockReturnValue('hashed-token');
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe(mockPersona.id);
      expect(result.user.email).toBe(mockPersona.email);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      setupQueryBuilder(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password hash is missing', async () => {
      setupQueryBuilder({ ...mockPersona, passwordHash: null });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when account is inactive', async () => {
      setupQueryBuilder({ ...mockPersona, estado: EstadoPersona.INACTIVO });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      setupQueryBuilder(mockPersona);
      passwordService.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should store IP and user agent with refresh token', async () => {
      setupQueryBuilder(mockPersona);
      passwordService.compare.mockResolvedValue(true);
      tokenService.getRefreshTokenExpirationMs.mockReturnValue(
        7 * 24 * 60 * 60 * 1000,
      );
      refreshTokenRepository.create.mockReturnValue({
        id: 'token-id',
      } as RefreshToken);
      refreshTokenRepository.save.mockResolvedValue({
        id: 'token-id',
      } as RefreshToken);
      tokenService.generateAccessToken.mockReturnValue('access-token');
      tokenService.generateRefreshToken.mockReturnValue('refresh-token');
      passwordService.hashToken.mockReturnValue('hashed-token');
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.login(loginDto, '192.168.1.1', 'Mozilla/5.0');

      expect(refreshTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });

  describe('refresh', () => {
    const validRefreshToken = 'valid-refresh-token';

    it('should refresh tokens with valid refresh token', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: mockPersona.id!,
        email: mockPersona.email!,
        tipo: mockPersona.tipo!,
        tokenId: 'token-uuid-456',
      });
      passwordService.hashToken.mockReturnValue('hashed-token');
      refreshTokenRepository.findOne.mockResolvedValue(
        mockRefreshToken as RefreshToken,
      );
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 } as any);
      tokenService.getRefreshTokenExpirationMs.mockReturnValue(
        7 * 24 * 60 * 60 * 1000,
      );
      refreshTokenRepository.create.mockReturnValue({
        id: 'new-token-id',
      } as RefreshToken);
      refreshTokenRepository.save.mockResolvedValue({
        id: 'new-token-id',
      } as RefreshToken);
      tokenService.generateAccessToken.mockReturnValue('new-access-token');
      tokenService.generateRefreshToken.mockReturnValue('new-refresh-token');

      const result = await service.refresh(validRefreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException when token verification fails', async () => {
      tokenService.verifyRefreshToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token not found in database', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: mockPersona.id!,
        email: mockPersona.email!,
        tipo: mockPersona.tipo!,
        tokenId: 'token-uuid-456',
      });
      passwordService.hashToken.mockReturnValue('hashed-token');
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: mockPersona.id!,
        email: mockPersona.email!,
        tipo: mockPersona.tipo!,
        tokenId: 'token-uuid-456',
      });
      passwordService.hashToken.mockReturnValue('hashed-token');
      refreshTokenRepository.findOne.mockResolvedValue(
        expiredToken as RefreshToken,
      );

      await expect(service.refresh(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should revoke old token on refresh (token rotation)', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: mockPersona.id!,
        email: mockPersona.email!,
        tipo: mockPersona.tipo!,
        tokenId: 'token-uuid-456',
      });
      passwordService.hashToken.mockReturnValue('hashed-token');
      refreshTokenRepository.findOne.mockResolvedValue(
        mockRefreshToken as RefreshToken,
      );
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 } as any);
      tokenService.getRefreshTokenExpirationMs.mockReturnValue(
        7 * 24 * 60 * 60 * 1000,
      );
      refreshTokenRepository.create.mockReturnValue({
        id: 'new-token-id',
      } as RefreshToken);
      refreshTokenRepository.save.mockResolvedValue({
        id: 'new-token-id',
      } as RefreshToken);
      tokenService.generateAccessToken.mockReturnValue('new-access-token');
      tokenService.generateRefreshToken.mockReturnValue('new-refresh-token');

      await service.refresh(validRefreshToken);

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        mockRefreshToken.id,
        expect.objectContaining({ revoked: true }),
      );
    });
  });

  describe('logout', () => {
    it('should revoke specific refresh token', async () => {
      const refreshToken = 'refresh-token-to-revoke';
      passwordService.hashToken.mockReturnValue('hashed-token');
      refreshTokenRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.logout('user-id', refreshToken);

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { tokenHash: 'hashed-token', personaId: 'user-id' },
        expect.objectContaining({ revoked: true }),
      );
    });

    it('should revoke all tokens when no specific token provided', async () => {
      refreshTokenRepository.update.mockResolvedValue({ affected: 3 } as any);

      await service.logout('user-id');

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { personaId: 'user-id', revoked: false },
        expect.objectContaining({ revoked: true }),
      );
    });
  });

  describe('changePassword', () => {
    const changePasswordDto: ChangePasswordDto = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword456!',
    };

    const setupQueryBuilder = (persona: Partial<Persona> | null) => {
      const queryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(persona),
      };
      personaRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);
      return queryBuilder;
    };

    it('should change password successfully', async () => {
      setupQueryBuilder(mockPersona);
      passwordService.compare
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(false); // new password is different
      passwordService.hash.mockResolvedValue('new-hashed-password');
      personaRepository.update.mockResolvedValue({ affected: 1 } as any);
      refreshTokenRepository.update.mockResolvedValue({ affected: 2 } as any);

      await service.changePassword('persona-uuid-123', changePasswordDto);

      expect(passwordService.compare).toHaveBeenCalledWith(
        'OldPassword123!',
        'hashed-password',
      );
      expect(passwordService.hash).toHaveBeenCalledWith('NewPassword456!');
      expect(personaRepository.update).toHaveBeenCalledWith(
        'persona-uuid-123',
        {
          passwordHash: 'new-hashed-password',
        },
      );
      // Should revoke all tokens for security
      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        { personaId: 'persona-uuid-123', revoked: false },
        expect.objectContaining({ revoked: true }),
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      setupQueryBuilder(null);

      await expect(
        service.changePassword('non-existent', changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user has no password hash', async () => {
      setupQueryBuilder({ ...mockPersona, passwordHash: null });

      await expect(
        service.changePassword('persona-uuid-123', changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when current password is wrong', async () => {
      setupQueryBuilder(mockPersona);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('persona-uuid-123', changePasswordDto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException with correct message when current password is wrong', async () => {
      setupQueryBuilder(mockPersona);
      passwordService.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('persona-uuid-123', changePasswordDto),
      ).rejects.toThrow('Contraseña actual incorrecta');
    });

    it('should throw BadRequestException when new password is same as current', async () => {
      setupQueryBuilder(mockPersona);
      passwordService.compare
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(true); // new password is same

      await expect(
        service.changePassword('persona-uuid-123', changePasswordDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException with correct message when passwords are same', async () => {
      setupQueryBuilder(mockPersona);
      passwordService.compare
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(true); // new password is same

      await expect(
        service.changePassword('persona-uuid-123', changePasswordDto),
      ).rejects.toThrow('La nueva contraseña debe ser diferente a la actual');
    });
  });
});
