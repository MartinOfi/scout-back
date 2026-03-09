import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Evento } from './evento.entity';

/**
 * Producto entity - Product for sale events
 *
 * From PRD §3.4 (F10):
 * - Each product has cost price and sale price
 * - Profit = (sale price - cost) × quantity sold
 * - A product belongs to ONE event only
 */
@Entity('productos')
export class Producto extends BaseEntity {
  /**
   * Event this product belongs to
   * A product belongs to ONE event only
   */
  @ManyToOne(() => Evento, (evento) => evento.productos, { nullable: false })
  @JoinColumn({ name: 'evento_id' })
  evento!: Evento;

  @Column({ name: 'evento_id' })
  eventoId!: string;

  @Column({ length: 100 })
  nombre!: string;

  /**
   * Cost price (what the group paid for it)
   */
  @Column('decimal', { precision: 10, scale: 2 })
  precioCosto!: number;

  /**
   * Sale price (what customers pay)
   */
  @Column('decimal', { precision: 10, scale: 2 })
  precioVenta!: number;

  /**
   * Profit per unit = precioVenta - precioCosto
   * Calculated, not stored
   */
}
