import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to link existing EGRESO/INGRESO pairs that were created
 * before the movimientoRelacionadoId field was added.
 *
 * Criteria for matching:
 * - Same responsable_id
 * - Same campamento_id or inscripcion_id (at least one must match)
 * - EGRESO has concepto = 'uso_saldo_personal'
 * - Dates within 5 seconds of each other
 * - Neither is soft-deleted
 *
 * Note: Also fixes INGRESO.medioPago to 'mixto' when there's a physical
 * payment component (montoIngreso > montoEgreso), since older code had
 * a bug that left medioPago as 'efectivo' instead of 'mixto'.
 */
export class LinkRelatedMovimientos1711579200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Find and link INGRESO -> EGRESO pairs, also fix medioPago if needed
    // Uses 5 second window to match the original delete logic
    // Note: Column names are camelCase (TypeORM default) except for explicit snake_case
    await queryRunner.query(`
      WITH pairs AS (
        SELECT
          ingreso.id as ingreso_id,
          egreso.id as egreso_id,
          ingreso.monto as ingreso_monto,
          egreso.monto as egreso_monto
        FROM movimientos ingreso
        INNER JOIN movimientos egreso ON (
          ingreso.responsable_id = egreso.responsable_id
          AND ingreso.tipo = 'ingreso'
          AND egreso.tipo = 'egreso'
          AND egreso.concepto = 'uso_saldo_personal'
          AND ingreso.movimiento_relacionado_id IS NULL
          AND egreso.movimiento_relacionado_id IS NULL
          AND ingreso."deletedAt" IS NULL
          AND egreso."deletedAt" IS NULL
          AND ABS(EXTRACT(EPOCH FROM (ingreso.fecha - egreso.fecha))) < 5
          AND (
            (ingreso.campamento_id IS NOT NULL AND ingreso.campamento_id = egreso.campamento_id)
            OR (ingreso.inscripcion_id IS NOT NULL AND ingreso.inscripcion_id = egreso.inscripcion_id)
          )
        )
      )
      UPDATE movimientos
      SET
        movimiento_relacionado_id = pairs.egreso_id,
        "medioPago" = CASE
          WHEN pairs.ingreso_monto > pairs.egreso_monto THEN 'mixto'::movimientos_mediopago_enum
          ELSE 'saldo_personal'::movimientos_mediopago_enum
        END
      FROM pairs
      WHERE movimientos.id = pairs.ingreso_id
    `);

    // Link EGRESO -> INGRESO (reverse direction for bidirectional relationship)
    await queryRunner.query(`
      WITH pairs AS (
        SELECT
          ingreso.id as ingreso_id,
          egreso.id as egreso_id
        FROM movimientos ingreso
        INNER JOIN movimientos egreso ON (
          ingreso.responsable_id = egreso.responsable_id
          AND ingreso.tipo = 'ingreso'
          AND egreso.tipo = 'egreso'
          AND egreso.concepto = 'uso_saldo_personal'
          AND ingreso.movimiento_relacionado_id = egreso.id
          AND egreso.movimiento_relacionado_id IS NULL
          AND ingreso."deletedAt" IS NULL
          AND egreso."deletedAt" IS NULL
        )
      )
      UPDATE movimientos
      SET movimiento_relacionado_id = pairs.ingreso_id
      FROM pairs
      WHERE movimientos.id = pairs.egreso_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all bidirectional links
    await queryRunner.query(`
      UPDATE movimientos
      SET movimiento_relacionado_id = NULL
      WHERE movimiento_relacionado_id IS NOT NULL
    `);
  }
}
