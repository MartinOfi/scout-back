import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { JwtPayload, JwtRefreshPayload } from '../interfaces';
import { PersonaType } from '../../../common/enums';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockJwtPayload: JwtPayload = {
    sub: 'user-uuid-123',
    email: 'test@example.com',
    tipo: PersonaType.EDUCADOR,
  };

  const mockJwtRefreshPayload: JwtRefreshPayload = {
    ...mockJwtPayload,
    tokenId: 'token-uuid-456',
  };

  beforeEach(async () => {
    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn(),
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate an access token', () => {
      const expectedToken = 'access-token-xyz';
      jwtService.sign.mockReturnValue(expectedToken);

      const result = service.generateAccessToken(mockJwtPayload);

      expect(result).toBe(expectedToken);
      expect(jwtService.sign).toHaveBeenCalledWith(mockJwtPayload);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token with separate secret', () => {
      const expectedToken = 'refresh-token-xyz';
      const refreshSecret = 'refresh-secret-key';
      const refreshExpiresIn = '7d';

      jwtService.sign.mockReturnValue(expectedToken);
      configService.getOrThrow.mockReturnValue(refreshSecret);
      configService.get.mockReturnValue(refreshExpiresIn);

      const result = service.generateRefreshToken(mockJwtRefreshPayload);

      expect(result).toBe(expectedToken);
      expect(jwtService.sign).toHaveBeenCalledWith(mockJwtRefreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      });
      expect(configService.getOrThrow).toHaveBeenCalledWith(
        'JWT_REFRESH_SECRET',
      );
      expect(configService.get).toHaveBeenCalledWith(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify and return access token payload', () => {
      jwtService.verify.mockReturnValue(mockJwtPayload);

      const result = service.verifyAccessToken('valid-token');

      expect(result).toEqual(mockJwtPayload);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
    });

    it('should throw when token is invalid', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => service.verifyAccessToken('invalid-token')).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify refresh token with separate secret', () => {
      const refreshSecret = 'refresh-secret-key';
      configService.getOrThrow.mockReturnValue(refreshSecret);
      jwtService.verify.mockReturnValue(mockJwtRefreshPayload);

      const result = service.verifyRefreshToken('valid-refresh-token');

      expect(result).toEqual(mockJwtRefreshPayload);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: refreshSecret,
      });
    });

    it('should throw when refresh token is invalid', () => {
      configService.getOrThrow.mockReturnValue('refresh-secret');
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => service.verifyRefreshToken('invalid-token')).toThrow();
    });
  });

  describe('getRefreshTokenExpirationMs', () => {
    it('should parse 7d expiration', () => {
      configService.get.mockReturnValue('7d');

      const result = service.getRefreshTokenExpirationMs();

      expect(result).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should parse 1h expiration', () => {
      configService.get.mockReturnValue('1h');

      const result = service.getRefreshTokenExpirationMs();

      expect(result).toBe(60 * 60 * 1000);
    });

    it('should parse 30m expiration', () => {
      configService.get.mockReturnValue('30m');

      const result = service.getRefreshTokenExpirationMs();

      expect(result).toBe(30 * 60 * 1000);
    });

    it('should parse 60s expiration', () => {
      configService.get.mockReturnValue('60s');

      const result = service.getRefreshTokenExpirationMs();

      expect(result).toBe(60 * 1000);
    });

    it('should return default 7 days for invalid format', () => {
      configService.get.mockReturnValue('invalid');

      const result = service.getRefreshTokenExpirationMs();

      expect(result).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should return default 7 days for empty string', () => {
      configService.get.mockReturnValue('');

      const result = service.getRefreshTokenExpirationMs();

      expect(result).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });
});
