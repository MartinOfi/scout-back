import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TipoEvento, DestinoGanancia } from '../../../common/enums';
import { Producto } from './producto.entity';

/**
 * Evento entity - Events (sales events and group events)
 *
 * From PRD §3.4 (F10, F11):
 * - Eventos de venta: Multiple products, profit goes to personal accounts or group
 * - Eventos de grupo: All revenue goes to group (cena, kermesse, etc.)
 */
@Entity('eventos')
export class Evento extends BaseEntity {
  @Column({ length: 100 })
  nombre!: string;

  @Column({ type: 'date' })
  fecha!: Date;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  /**
   * Type of event: venta or grupo
   */
  @Column({ type: 'enum', enum: TipoEvento })
  tipo!: TipoEvento;

  /**
   * Profit destination (only for VENTA events)
   * - cuentas_personales: distributed to participants who sold
   * - caja_grupo: all goes to group
   */
  @Column({ type: 'enum', enum: DestinoGanancia, nullable: true })
  destinoGanancia!: DestinoGanancia | null;

  /**
   * Type of group event (cena, kermesse, etc.)
   * Only for GRUPO events
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  tipoEvento!: string | null;

  /**
   * Products for this event (only for VENTA events)
   * A product belongs to ONE event only
   */
  @OneToMany(() => Producto, (producto) => producto.evento)
  productos!: Producto[];

  /**
   * Whether the event has been closed/finalized.
   *
   * A closed event is immutable: no new ventas, no edits, no deletes
   * of ventas / movimientos linked to it. The flag is enforced by
   * EventosService and VentasEventoService via assertEventoModificable.
   *
   * Default false; set to true via the (future) "cerrar evento" endpoint.
   */
  @Column({ name: 'esta_cerrado', type: 'boolean', default: false })
  estaCerrado!: boolean;

  /**
   * Incomes, expenses, and sales are tracked via Movimiento entities
   * with eventoId = this.id
   */
}
