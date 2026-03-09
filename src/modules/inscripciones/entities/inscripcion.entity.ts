import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TipoInscripcion } from '../../../common/enums';
import { Persona } from '../../personas/entities/persona.entity';

/**
 * Inscripcion entity - Annual registration (Grupo or Scout Argentina)
 *
 * Each inscription records a person for a specific year and type.
 * Payment status is calculated dynamically from related movements.
 */
@Entity('inscripciones')
@Unique(['personaId', 'ano', 'tipo'])
export class Inscripcion extends BaseEntity {
  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @Column({ name: 'persona_id' })
  personaId!: string;

  @Column({ type: 'enum', enum: TipoInscripcion })
  tipo!: TipoInscripcion;

  @Column()
  ano!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  montoTotal!: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  montoBonificado!: number;
}
