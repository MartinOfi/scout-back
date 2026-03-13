import { PersonaType } from '../../../common/enums';

/**
 * JWT Access Token payload structure
 */
export interface JwtPayload {
  /** Persona ID (UUID) */
  sub: string;
  /** User email */
  email: string;
  /** Persona type (discriminator) */
  tipo: PersonaType;
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
}

/**
 * JWT Refresh Token payload structure
 * Extends JwtPayload with token ID for revocation
 */
export interface JwtRefreshPayload extends JwtPayload {
  /** Refresh token entity ID for revocation tracking */
  tokenId: string;
}
