import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CampamentoParticipante } from './campamento-participante.entity';

/**
 * Campamento entity - Camp/excursion
 *
 * From PRD §3.4 (F12):
 * - Separate from events for flexibility
 * - Has cost per person and suggested installments (informative)
 * - Participants list is DYNAMIC (assigned over time, not at creation)
 * - Flexible payments (unlimited payments per participant)
 */
@Entity('campamentos')
export class Campamento extends BaseEntity {
  @Column({ length: 100 })
  nombre!: string;

  @Column({ type: 'date' })
  fechaInicio!: Date;

  @Column({ type: 'date' })
  fechaFin!: Date;

  /**
   * Cost per person
   */
  @Column('decimal', { precision: 10, scale: 2 })
  costoPorPersona!: number;

  /**
   * Aporte esperado de los educadores. Default 0: los educadores quedan
   * exentos y no se les registran pagos ni bonificaciones.
   *
   * Si se pone > 0, cada educador que no aporte consume ese monto completo
   * del fondo solidario al bonificarlo. Dejarlo en 0 salvo que se espere
   * cobrarles.
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  costoEducadores!: number;

  /**
   * Suggested number of installments (informative only, not restrictive)
   */
  @Column({ default: 1 })
  cuotasBase!: number;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @OneToMany(() => CampamentoParticipante, (cp) => cp.campamento)
  participantes!: CampamentoParticipante[];

  /**
   * Payments and expenses are tracked via Movimiento entities
   * with campamentoId = this.id
   */
}
