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
}
