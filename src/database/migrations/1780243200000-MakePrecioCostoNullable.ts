import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes productos.precio_costo nullable so a product can be created with only
 * its sale price when the cost is not yet decided. The cost is filled in later
 * and is required before the event's movimientos can be habilitado.
 */
export class MakePrecioCostoNullable1780243200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "productos"
      ALTER COLUMN "precioCosto" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Back-fill any NULL costs to 0 so the NOT NULL constraint can be restored.
    await queryRunner.query(`
      UPDATE "productos"
      SET "precioCosto" = 0
      WHERE "precioCosto" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "productos"
      ALTER COLUMN "precioCosto" SET NOT NULL
    `);
  }
}
