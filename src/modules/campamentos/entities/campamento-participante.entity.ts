import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Persona } from '../../personas/entities/persona.entity';
import { Campamento } from './campamento.entity';

@Entity('campamento_participante')
export class CampamentoParticipante extends BaseEntity {
  @ManyToOne(() => Campamento, (campamento) => campamento.participantes, {
    nullable: false,
  })
  @JoinColumn({ name: 'campamento_id' })
  campamento!: Campamento;

  @Column({ name: 'campamento_id' })
  campamentoId!: string;

  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'persona_id' })
  persona!: Persona;

  @Column({ name: 'persona_id' })
  personaId!: string;

  @Column({ name: 'autorizacion_entregada', default: false })
  autorizacionEntregada!: boolean;

  /**
   * Monto que este participante debe pagar. Snapshot copiado al agregarlo:
   * costoEducadores si es educador, costoPorPersona si no. Deliberadamente
   * un snapshot: editar el costo del campamento después no reescribe esto.
   */
  @Column('decimal', { precision: 10, scale: 2 })
  montoAsignado!: number;

  /**
   * Monto cubierto por el fondo solidario. Se modifica sólo vía
   * BonificacionesService, nunca directo.
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  montoBonificado!: number;
}
