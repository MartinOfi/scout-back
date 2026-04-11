import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Evento } from './evento.entity';
import { Producto } from './producto.entity';
import { Persona } from '../../personas/entities/persona.entity';
import { Movimiento } from '../../movimientos/entities/movimiento.entity';

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
   * Linked income Movimiento generated when this sale was registered.
   *
   * Cardinality is N:1 — many ventas (e.g. those created in a single
   * registrarVentasLote call) can share the same aggregated movimiento.
   *
   * Nullable for backward-compat with rows created before this column existed.
   * The DB-level FK is ON DELETE SET NULL: if the movimiento is removed via
   * a different code path, the venta survives without dangling references.
   */
  @ManyToOne(() => Movimiento, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'movimiento_id' })
  movimiento!: Movimiento | null;

  @Column({ name: 'movimiento_id', type: 'uuid', nullable: true })
  movimientoId!: string | null;

  /**
   * Profit for this sale = (producto.precioVenta - producto.precioCosto) × cantidad
   * Calculated, not stored
   */
}
