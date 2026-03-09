import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Evento } from './evento.entity';
import { Producto } from './producto.entity';
import { Persona } from '../../personas/entities/persona.entity';

/**
 * VentaProducto entity - Sales record per product per participant
 *
 * From PRD §3.4 (F10):
 * - Register quantity sold per product per participant
 * - Profit per person = sum of (sale price - cost) × quantity for each product
 * - All active members participate implicitly; only actual sales are recorded
 */
@Entity('ventas_productos')
export class VentaProducto extends BaseEntity {
  /**
   * Event where this sale occurred
   */
  @ManyToOne(() => Evento, { nullable: false })
  @JoinColumn({ name: 'evento_id' })
  evento!: Evento;

  @Column({ name: 'evento_id' })
  eventoId!: string;

  /**
   * Product that was sold
   */
  @ManyToOne(() => Producto, { nullable: false })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column({ name: 'producto_id' })
  productoId!: string;

  /**
   * Person who sold (vendedor)
   */
  @ManyToOne(() => Persona, { nullable: false })
  @JoinColumn({ name: 'vendedor_id' })
  vendedor!: Persona;

  @Column({ name: 'vendedor_id' })
  vendedorId!: string;

  /**
   * Quantity sold by this person for this product
   */
  @Column()
  cantidad!: number;

  /**
   * Profit for this sale = (producto.precioVenta - producto.precioCosto) × cantidad
   * Calculated, not stored
   */
}
