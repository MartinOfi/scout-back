import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Evento } from './evento.entity';
import { Persona } from '../../personas/entities/persona.entity';
import { EntregaLinea } from './entrega-linea.entity';

/**
 * Entrega entity - Header for a product pickup at a sale event.
 *
 * Models the physical delivery of products sold by a vendor. The same
 * vendor's stock (one or more VentaProducto rows aggregated by
 * eventoId + productoId + vendedorId) can be picked up across multiple
 * Entrega rows by different people.
 *
 * Stock disponible (eventoId, productoId, vendedorId) =
 *   SUM(VentaProducto.cantidad) - SUM(EntregaLinea.cantidad)
 * considering only non soft-deleted rows on both sides.
 */
@Entity('entregas')
export class Entrega extends BaseEntity {
  @ManyToOne(() => Evento, { nullable: false })
  @JoinColumn({ name: 'evento_id' })
  evento!: Evento;

  @Column({ name: 'evento_id' })
  eventoId!: string;

  /**
   * Vendor whose sales are being delivered.
   * Not necessarily the person picking up — that goes in `notas`.
   */
  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'vendedor_id' })
  vendedor!: Persona;

  @Column({ name: 'vendedor_id' })
  vendedorId!: string;

  /**
   * When the delivery happened. Nullable to allow post-hoc registration
   * without forcing a default that hides the unknown.
   */
  @Column({ type: 'timestamptz', nullable: true })
  fecha!: Date | null;

  /**
   * Free-form notes. Operator writes who picked up, time, etc.
   * e.g. "Retiró María 18:30"
   */
  @Column({ type: 'text', nullable: true })
  notas!: string | null;

  /**
   * Admin user who registered this entrega.
   * TODO: Add relation when Usuario entity is created.
   */
  @Column({ name: 'registrado_por_id', type: 'uuid', nullable: true })
  registradoPorId!: string | null;

  @OneToMany(() => EntregaLinea, (linea) => linea.entrega)
  lineas!: EntregaLinea[];
}
