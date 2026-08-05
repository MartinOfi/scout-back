import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Evento } from './evento.entity';
import { Producto } from './producto.entity';
import { Persona } from '../../personas/entities/persona.entity';
import { Movimiento } from '../../movimientos/entities/movimiento.entity';
import { DestinoGanancia, EstadoCobroVenta } from '../../../common/enums';

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
   * Person who sold (vendedor).
   *
   * May be an Agrupacion (PersonaType.AGRUPACION) when the group itself sold —
   * e.g. a park stand with no individual seller. That is why this stays
   * NOT NULL: "the group sold it" is a real vendedor, not a missing one, so
   * aggregations keep their inner joins and no sale can silently drop out of
   * the report.
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
   * Where the margen of THIS venta goes. Snapshot taken at registration time.
   *
   * In a UNICA event it always equals evento.destinoGanancia; in a MIXTA event
   * each lote declares its own. This — not the evento — is what
   * resolveCajaForVenta and shouldGenerateRecuperoCosto read.
   *
   * A venta sold by an Agrupacion can only be CAJA_GRUPO: there is no personal
   * caja to credit. The rule is enforced by CajasService.getOrCreateCajaPersonal,
   * which rejects agrupaciones for every caller in the system, not just eventos.
   */
  @Column({
    name: 'destino_ganancia',
    type: 'enum',
    enum: DestinoGanancia,
    enumName: 'ventas_productos_destino_ganancia_enum',
  })
  destinoGanancia!: DestinoGanancia;

  /**
   * Whether the money for this venta actually came in.
   *
   * Source of truth from which the linked movimiento's EstadoPago is derived
   * (PENDIENTE → EstadoPago.PENDIENTE_COBRO), so a recorded-but-uncollected
   * sale never inflates a caja balance. Flipped to COBRADO — together with its
   * movimientos, in one transaction — by the "cobrar" endpoint.
   */
  @Column({
    name: 'estado_cobro',
    type: 'enum',
    enum: EstadoCobroVenta,
    enumName: 'ventas_productos_estado_cobro_enum',
    default: EstadoCobroVenta.COBRADO,
  })
  estadoCobro!: EstadoCobroVenta;

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
   * Linked cost-recovery Movimiento (INGRESO to the caja grupo), generated only
   * for VENTA events whose destinoGanancia is CUENTAS_PERSONALES. In that mode
   * the margen goes to the seller's caja personal (via `movimiento` above) while
   * the cost is returned to the group via this second movimiento, so the caja
   * grupo nets to zero over what was actually sold.
   *
   * Same N:1 cardinality and lifecycle as `movimiento`: ventas created in a
   * single registrarVentasLote call share one aggregated recupero movimiento.
   * Nullable for caja_grupo / grupo events and for rows created before this
   * column existed. ON DELETE SET NULL mirrors `movimiento`.
   */
  @ManyToOne(() => Movimiento, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'movimiento_recupero_id' })
  movimientoRecupero!: Movimiento | null;

  @Column({ name: 'movimiento_recupero_id', type: 'uuid', nullable: true })
  movimientoRecuperoId!: string | null;

  /**
   * Profit for this sale = (producto.precioVenta - producto.precioCosto) × cantidad
   * Calculated, not stored
   */
}
