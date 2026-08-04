import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `bonificacion_otorgada` and `bonificacion_recibida` to the Postgres
 * enum backing `movimientos.concepto`.
 *
 * The TypeScript enum already lists them, but Postgres enum types are part
 * of the schema: without ALTER TYPE any INSERT using either value fails with
 * `invalid input value for enum movimientos_concepto_enum`.
 *
 * NOTE: Postgres cannot DROP an enum value, so down() is intentionally a no-op.
 */
export class AddBonificacionConceptos1780329600001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "movimientos_concepto_enum"
      ADD VALUE IF NOT EXISTS 'bonificacion_otorgada'
    `);
    await queryRunner.query(`
      ALTER TYPE "movimientos_concepto_enum"
      ADD VALUE IF NOT EXISTS 'bonificacion_recibida'
    `);
  }

  public async down(): Promise<void> {
    // Postgres does not support removing a value from an enum type.
  }
}
