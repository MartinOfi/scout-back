import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EstadoCuota } from '../../../common/enums';
import { Persona } from '../../personas/entities/persona.entity';

/**
 * Cuota entity - Group fee
 *
 * From PRD §3.3 (F9):
 * - Similar to inscription but without bonification
 * - Can have multiple fees per year
 * - Flexible payment (multiple payments allowed)
 */
@Entity('cuotas')
export class Cuota extends BaseEntity {
  /**
   * Person this fee belongs to
   */
  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @Column({ name: 'persona_id' })
  personaId!: string;

  /**
   * Name/description of the fee (e.g., "Cuota Marzo 2026")
   */
  @Column({ length: 100 })
  nombre!: string;

  /**
   * Year this fee corresponds to
   */
  @Column()
  ano!: number;

  /**
   * Total amount to pay
   */
  @Column('decimal', { precision: 10, scale: 2 })
  montoTotal!: number;

  /**
   * Amount already paid
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  montoPagado!: number;

  /**
   * Current state of the fee
   */
  @Column({ type: 'enum', enum: EstadoCuota, default: EstadoCuota.PENDIENTE })
  estado!: EstadoCuota;

  /**
   * Payments are tracked via Movimiento entities with cuotaId = this.id
   */
}
