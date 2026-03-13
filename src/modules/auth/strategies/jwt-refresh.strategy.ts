import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtRefreshPayload } from '../interfaces';

interface RefreshTokenRequest extends Request {
  body: {
    refreshToken?: string;
  };
}

/**
 * JWT Refresh Strategy for refresh token validation
 * Extracts token from request body
 * Returns payload with token for service-level validation
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  /**
   * Validate refresh token payload
   * Returns payload with original token for database lookup
   */
  validate(req: RefreshTokenRequest, payload: JwtRefreshPayload) {
    const refreshToken = req.body.refreshToken;
    return { ...payload, refreshToken };
  }
}
