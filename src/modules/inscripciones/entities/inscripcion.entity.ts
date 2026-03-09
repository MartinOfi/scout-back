import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EstadoInscripcion } from '../../../common/enums';
import { Persona } from '../../personas/entities/persona.entity';

/**
 * Inscripcion entity - Annual Scout Argentina registration
 *
 * Each inscription is a record for a specific year with:
 * - Year it corresponds to
 * - Total amount
 * - Bonified amount (if applicable)
 * - Paid amount
 * - Payment history
 *
 * From PRD §3.3 (F8) and §4/RN9:
 * - Dual flow: income (family payment) + expense (payment to Scout Argentina)
 * - Automatic bonification for first-time protagonists
 */
@Entity('inscripciones')
export class Inscripcion extends BaseEntity {
  /**
   * Person this inscription belongs to
   */
  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @Column({ name: 'persona_id' })
  personaId!: string;

  /**
   * Year this inscription corresponds to
   */
  @Column()
  ano!: number;

  /**
   * Total amount to pay
   */
  @Column('decimal', { precision: 10, scale: 2 })
  montoTotal!: number;

  /**
   * Bonified amount (0 if not bonified, or full amount if bonified)
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  montoBonificado!: number;

  /**
   * Amount already paid
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  montoPagado!: number;

  /**
   * Current state of the inscription
   */
  @Column({
    type: 'enum',
    enum: EstadoInscripcion,
    default: EstadoInscripcion.PENDIENTE,
  })
  estado!: EstadoInscripcion;

  /**
   * Reference to bonification movement (if was bonified)
   */
  @Column({ name: 'movimiento_bonificacion_id', type: 'uuid', nullable: true })
  movimientoBonificacionId!: string | null;

  /**
   * Payments are tracked via Movimiento entities with inscripcionId = this.id
   * Use MovimientoService to get payment history
   */
}
