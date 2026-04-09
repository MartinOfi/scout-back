import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration to add partial indexes on frequently queried foreign key columns
 * in the movimientos and cajas tables.
 *
 * All indexes are partial (WHERE "deletedAt" IS NULL) to exclude soft-deleted
 * records and keep index size small.
 */
export class AddPerformanceIndexes1712678400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // movimientos: FK indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_caja_id
      ON movimientos(caja_id)
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_inscripcion_id
      ON movimientos(inscripcion_id)
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_campamento_id
      ON movimientos(campamento_id)
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_evento_id
      ON movimientos(evento_id)
      WHERE "deletedAt" IS NULL
    `);

    // movimientos: estadoPago enum column (camelCase in DB)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_estado_pago
      ON movimientos("estadoPago")
      WHERE "deletedAt" IS NULL
    `);

    // movimientos: fecha descending for time-range queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_fecha
      ON movimientos(fecha DESC)
      WHERE "deletedAt" IS NULL
    `);

    // movimientos: composite index for calcularSaldo (caja_id + tipo + estadoPago)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_movimientos_caja_saldo
      ON movimientos(caja_id, tipo, "estadoPago")
      WHERE "deletedAt" IS NULL
    `);

    // cajas: tipo index
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cajas_tipo
      ON cajas(tipo)
      WHERE "deletedAt" IS NULL
    `);

    // cajas: composite index for tipo + propietario_id lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_cajas_tipo_propietario
      ON cajas(tipo, propietario_id)
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimientos_caja_id`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_movimientos_inscripcion_id`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_movimientos_campamento_id`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimientos_evento_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimientos_estado_pago`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimientos_fecha`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_movimientos_caja_saldo`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cajas_tipo`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_cajas_tipo_propietario`);
  }
}
