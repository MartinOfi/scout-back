import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Entrega } from './entrega.entity';
import { Producto } from './producto.entity';

/**
 * EntregaLinea entity - Detail row for one product within an Entrega.
 *
 * An Entrega can deliver multiple products of the same vendor in a single
 * pickup (e.g. 3 locros + 2 empanadas). Each line tracks one product and
 * its delivered quantity.
 */
@Entity('entregas_lineas')
export class EntregaLinea extends BaseEntity {
  @ManyToOne(() => Entrega, (entrega) => entrega.lineas, { nullable: false })
  @JoinColumn({ name: 'entrega_id' })
  entrega!: Entrega;

  @Column({ name: 'entrega_id' })
  entregaId!: string;

  @ManyToOne(() => Producto, { nullable: false })
  @JoinColumn({ name: 'producto_id' })
  producto!: Producto;

  @Column({ name: 'producto_id' })
  productoId!: string;

  /**
   * Delivered quantity. Always positive integer.
   */
  @Column({ type: 'int' })
  cantidad!: number;
}
