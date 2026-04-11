import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `movimiento_id` foreign key column to `ventas_productos`.
 *
 * Purpose
 * -------
 * Establishes an explicit link from each VentaProducto to the Movimiento
 * generated as its financial counterpart (income in caja_grupo / caja_personal).
 *
 * Behaviour
 * ---------
 * - Nullable to support backward-compat: existing rows stay valid until backfilled.
 *   The backfill is a separate migration so that a data-only failure does not
 *   require reverting the schema change.
 * - ON DELETE SET NULL: if the linked movimiento is removed via a different code
 *   path (e.g. /movimientos/:id), the venta is preserved with movimiento_id = NULL.
 *   The KPI calculation in EventosService.getKpisEvento already tolerates this:
 *   `totalRecaudado` is computed from producto.precioVenta and does not depend on
 *   the linked movimiento.
 * - Partial index `WHERE "deletedAt" IS NULL` keeps the index small and only
 *   covers live rows, which is exactly what the new delete path queries.
 */
export class AddMovimientoIdToVentasProductos1713000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ventas_productos
      ADD COLUMN movimiento_id uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE ventas_productos
      ADD CONSTRAINT fk_ventas_productos_movimiento_id
      FOREIGN KEY (movimiento_id)
      REFERENCES movimientos(id)
      ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ventas_productos_movimiento_id
      ON ventas_productos(movimiento_id)
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_ventas_productos_movimiento_id
    `);

    await queryRunner.query(`
      ALTER TABLE ventas_productos
      DROP CONSTRAINT IF EXISTS fk_ventas_productos_movimiento_id
    `);

    await queryRunner.query(`
      ALTER TABLE ventas_productos
      DROP COLUMN IF EXISTS movimiento_id
    `);
  }
}
