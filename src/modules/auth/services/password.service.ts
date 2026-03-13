import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

/**
 * Service for password hashing and token hashing operations
 * Uses bcrypt for passwords (slow, secure)
 * Uses SHA-256 for tokens (fast, tokens are already random)
 */
@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12;

  /**
   * Hash a password using bcrypt
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare a plain password with a bcrypt hash
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Hash a token using SHA-256
   * Used for refresh tokens (already random, need fast lookup)
   */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
