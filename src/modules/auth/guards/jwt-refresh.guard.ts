import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Refresh Token Guard
 * Validates refresh token from request body
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
