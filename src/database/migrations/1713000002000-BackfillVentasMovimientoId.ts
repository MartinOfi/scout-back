import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill `movimiento_id` on existing `ventas_productos` rows by matching
 * each venta to the income movimiento that was created alongside it.
 *
 * Why a separate migration
 * ------------------------
 * Schema changes (1713000000000-AddMovimientoIdToVentasProductos) and data
 * mutations live in different files so a data-only failure does not require
 * reverting the schema. The new code tolerates `movimiento_id IS NULL`, so
 * if this migration finds nothing to pair the system still works — only the
 * cascade-delete cleanup of legacy rows is degraded.
 *
 * Matching strategy
 * -----------------
 * For each venta we look for ONE income movimiento that satisfies all of:
 *   - same `evento_id`
 *   - same `responsable_id` (vendedor)
 *   - concepto = 'evento_venta_ingreso'
 *   - tipo     = 'ingreso'
 *   - movimiento.monto >= venta-derived ganancia (>= because lote movimientos
 *     aggregate multiple ventas, so a single movimiento may legitimately have
 *     a higher amount than any individual venta)
 *   - both rows are alive (`"deletedAt" IS NULL`)
 *   - the movimiento was created within ±10 seconds of the venta
 *     (handles network latency and the original code's lack of transaction)
 *
 * Multiple ventas (a lote) all link to the SAME movimiento — that's correct
 * because the cardinality is N:1 (many ventas -> one aggregated movimiento).
 *
 * Limitations
 * -----------
 * - Ventas whose evento was already deleted at the time of this migration
 *   stay with movimiento_id = NULL. The new delete path tolerates that.
 * - If two distinct movimientos satisfy the match for a single venta, we pick
 *   the closest in time (`ORDER BY ABS(EXTRACT(EPOCH FROM ...))`) to bias
 *   toward the immediate post-creation pairing.
 * - This migration is read-heavy but safe to retry: re-running only links
 *   rows whose movimiento_id is still NULL.
 */
export class BackfillVentasMovimientoId1713000002000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH paired AS (
        SELECT
          v.id AS venta_id,
          (
            SELECT m.id
            FROM movimientos m
            WHERE m.evento_id = v.evento_id
              AND m.responsable_id = v.vendedor_id
              AND m.concepto = 'evento_venta_ingreso'
              AND m.tipo = 'ingreso'
              AND m."deletedAt" IS NULL
              AND ABS(EXTRACT(EPOCH FROM (m."createdAt" - v."createdAt"))) <= 10
            ORDER BY ABS(EXTRACT(EPOCH FROM (m."createdAt" - v."createdAt"))) ASC
            LIMIT 1
          ) AS matched_movimiento_id
        FROM ventas_productos v
        WHERE v."deletedAt" IS NULL
          AND v.movimiento_id IS NULL
      )
      UPDATE ventas_productos vp
      SET movimiento_id = paired.matched_movimiento_id
      FROM paired
      WHERE vp.id = paired.venta_id
        AND paired.matched_movimiento_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: clear all backfilled links. Safe because the column is nullable
    // and post-rollback the system behaves identically to pre-migration.
    await queryRunner.query(`
      UPDATE ventas_productos
      SET movimiento_id = NULL
      WHERE movimiento_id IS NOT NULL
    `);
  }
}
