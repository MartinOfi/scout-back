import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the cost-recovery movimiento link to ventas_productos.
 *
 * For VENTA events with destinoGanancia = cuentas_personales, each venta now
 * generates a second INGRESO movimiento (the recovered cost) into the caja
 * grupo, in addition to the margen movimiento that goes to the seller's caja
 * personal. This column links the venta to that recupero movimiento, mirroring
 * `movimiento_id` (nullable, ON DELETE SET NULL).
 */
export class AddMovimientoRecuperoToVentasProductos1780156800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ventas_productos"
      ADD COLUMN IF NOT EXISTS "movimiento_recupero_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "ventas_productos"
      ADD CONSTRAINT "fk_ventas_productos_movimiento_recupero"
        FOREIGN KEY ("movimiento_recupero_id")
        REFERENCES "movimientos"("id")
        ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_ventas_productos_movimiento_recupero"
      ON "ventas_productos" ("movimiento_recupero_id")
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "ix_ventas_productos_movimiento_recupero"
    `);
    await queryRunner.query(`
      ALTER TABLE "ventas_productos"
      DROP CONSTRAINT IF EXISTS "fk_ventas_productos_movimiento_recupero"
    `);
    await queryRunner.query(`
      ALTER TABLE "ventas_productos"
      DROP COLUMN IF EXISTS "movimiento_recupero_id"
    `);
  }
}
