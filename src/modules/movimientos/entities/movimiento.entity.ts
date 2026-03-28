import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
} from '../../../common/enums';
import { Caja } from '../../cajas/entities/caja.entity';
import { Persona } from '../../personas/entities/persona.entity';

/**
 * Movimiento entity - Financial movement record
 * Every financial transaction is recorded as a movement
 *
 * From PRD §3.6 (F14): All movements must register:
 * - Date/time, type, amount, concept
 * - Origin/destination (caja)
 * - Related event/campamento/inscripcion
 * - Payment method
 * - Responsible person
 * - Receipt status (for expenses)
 * - Payment status
 * - Admin who registered
 */
@Entity('movimientos')
export class Movimiento extends BaseEntity {
  /**
   * Caja where this movement is registered
   */
  @ManyToOne(() => Caja, { nullable: false })
  @JoinColumn({ name: 'caja_id' })
  caja!: Caja;

  @Column({ name: 'caja_id' })
  cajaId!: string;

  /**
   * Type: income or expense
   */
  @Column({ type: 'enum', enum: TipoMovimiento })
  tipo!: TipoMovimiento;

  /**
   * Amount (always positive, tipo determines direction)
   */
  @Column('decimal', { precision: 10, scale: 2 })
  monto!: number;

  /**
   * Concept category (enum, not magic string)
   */
  @Column({ type: 'enum', enum: ConceptoMovimiento })
  concepto!: ConceptoMovimiento;

  /**
   * Free text description for additional context
   */
  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  /**
   * Person related to this movement:
   * - For income: who paid
   * - For expense: who made the expense
   */
  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'responsable_id' })
  responsable!: Persona;

  @Column({ name: 'responsable_id' })
  responsableId!: string;

  /**
   * Payment method
   */
  @Column({ type: 'enum', enum: MedioPago, default: MedioPago.EFECTIVO })
  medioPago!: MedioPago;

  /**
   * Whether receipt is required (default: true for expenses)
   */
  @Column({ default: true })
  requiereComprobante!: boolean;

  /**
   * Whether receipt was delivered (only if requiereComprobante = true)
   */
  @Column({ type: 'boolean', nullable: true })
  comprobanteEntregado!: boolean | null;

  /**
   * Payment status (for expenses that may be pending reimbursement)
   */
  @Column({ type: 'enum', enum: EstadoPago })
  estadoPago!: EstadoPago;

  /**
   * Person to reimburse (only if estadoPago = pendiente_reembolso)
   */
  @ManyToOne(() => Persona, { nullable: true })
  @JoinColumn({ name: 'persona_a_reembolsar_id' })
  personaAReembolsar!: Persona | null;

  @Column({ name: 'persona_a_reembolsar_id', type: 'uuid', nullable: true })
  personaAReembolsarId!: string | null;

  /**
   * Date of the movement
   */
  @Column({ type: 'timestamptz' })
  fecha!: Date;

  // ==========================================================================
  // Optional references to related entities
  // ==========================================================================

  /**
   * Related event (if applicable)
   */
  @Column({ name: 'evento_id', type: 'uuid', nullable: true })
  eventoId!: string | null;

  /**
   * Related campamento (if applicable)
   */
  @Column({ name: 'campamento_id', type: 'uuid', nullable: true })
  campamentoId!: string | null;

  /**
   * Related inscripcion (if applicable)
   */
  @Column({ name: 'inscripcion_id', type: 'uuid', nullable: true })
  inscripcionId!: string | null;

  /**
   * Related cuota (if applicable)
   */
  @Column({ name: 'cuota_id', type: 'uuid', nullable: true })
  cuotaId!: string | null;

  // ==========================================================================
  // Related movement (for linked operations)
  // ==========================================================================

  /**
   * Related movement ID (for linked operations like mixed payments)
   * When a payment uses personal balance, the EGRESO from personal account
   * and the INGRESO to group account are linked via this field.
   * Both movements point to each other for bidirectional relationship.
   */
  @Column({ name: 'movimiento_relacionado_id', type: 'uuid', nullable: true })
  movimientoRelacionadoId!: string | null;

  // ==========================================================================
  // Audit field
  // ==========================================================================

  /**
   * Admin user who registered this movement
   * TODO: Add relation when Usuario entity is created
   */
  @Column({ name: 'registrado_por_id', type: 'uuid', nullable: true })
  registradoPorId!: string | null;
}
