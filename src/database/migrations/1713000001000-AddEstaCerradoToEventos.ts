import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `esta_cerrado` flag to the `eventos` table.
 *
 * Purpose
 * -------
 * Marks events that have been finalized and must not accept further mutations
 * (no new ventas, no edits, no deletes of ventas/movimientos linked to them).
 *
 * Notes
 * -----
 * - Default `false` so existing events remain mutable until explicitly closed.
 * - Kept in its own migration (separate from movimiento_id) to honour the rule
 *   "one migration, one purpose": rolling back this column does not affect
 *   the venta-movimiento link work and vice versa.
 * - The "close event" feature (CerrarEventoVentaDto) exists in the DTO layer
 *   but is not yet wired to a controller; the column gives the new
 *   VentasEventoService a stable contract to depend on now, so the day the
 *   close-event endpoint lands the guard already enforces immutability.
 */
export class AddEstaCerradoToEventos1713000001000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE eventos
      ADD COLUMN esta_cerrado boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE eventos
      DROP COLUMN IF EXISTS esta_cerrado
    `);
  }
}
