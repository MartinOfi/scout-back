import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CajaType } from '../../../common/enums';
import { Persona } from '../../personas/entities/persona.entity';

/**
 * Caja entity - Unified financial account
 * Types:
 * - GRUPO: Caja principal del grupo scout
 * - RAMA_*: Fondos de cada rama (Manada, Unidad, Caminantes, Rovers)
 * - PERSONAL: Cuenta personal de protagonista/educador
 *
 * IMPORTANT: saldoActual is NEVER stored, always calculated from movements
 */
@Entity('cajas')
export class Caja extends BaseEntity {
  @Column({ type: 'enum', enum: CajaType })
  tipo!: CajaType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nombre!: string | null;

  /**
   * Propietario de la caja (solo para tipo PERSONAL)
   * Para GRUPO y RAMA_*, este campo es null
   */
  @ManyToOne(() => Persona, { nullable: true })
  @JoinColumn({ name: 'propietario_id' })
  propietario!: Persona | null;

  @Column({ name: 'propietario_id', type: 'uuid', nullable: true })
  propietarioId!: string | null;
}
