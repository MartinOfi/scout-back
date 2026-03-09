import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Persona } from '../../personas/entities/persona.entity';

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
   * Suggested number of installments (informative only, not restrictive)
   */
  @Column({ default: 1 })
  cuotasBase!: number;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  /**
   * Participants - Dynamic list
   * Assigned over time, not necessarily at creation
   */
  @ManyToMany(() => Persona)
  @JoinTable({
    name: 'campamento_participantes',
    joinColumn: { name: 'campamento_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'persona_id', referencedColumnName: 'id' },
  })
  participantes!: Persona[];

  /**
   * Payments and expenses are tracked via Movimiento entities
   * with campamentoId = this.id
   */
}
