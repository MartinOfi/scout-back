import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Persona } from '../../personas/entities/persona.entity';

/**
 * Refresh token entity for JWT authentication
 * Stores hashed refresh tokens with metadata for session management
 * Tokens are rotated on each use and can be revoked
 */
@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @Column({ type: 'varchar', length: 64, unique: true })
  @Index()
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  // =========================================================================
  // Relations
  // =========================================================================

  @ManyToOne(() => Persona, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @Column({ type: 'uuid', name: 'persona_id' })
  personaId!: string;
}
