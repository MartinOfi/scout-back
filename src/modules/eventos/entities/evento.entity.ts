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
   * Incomes, expenses, and sales are tracked via Movimiento entities
   * with eventoId = this.id
   */
}
