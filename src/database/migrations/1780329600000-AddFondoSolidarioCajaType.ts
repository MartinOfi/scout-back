import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `fondo_solidario` to the Postgres enum backing `cajas.tipo`.
 *
 * The TypeScript enum already lists it, but Postgres enum types are part of
 * the schema: without ALTER TYPE any INSERT using it fails with
 * `invalid input value for enum cajas_tipo_enum`.
 *
 * NOTE: Postgres cannot DROP an enum value, so down() is intentionally a no-op.
 */
export class AddFondoSolidarioCajaType1780329600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "cajas_tipo_enum"
      ADD VALUE IF NOT EXISTS 'fondo_solidario'
    `);
  }

  public async down(): Promise<void> {
    // Postgres does not support removing a value from an enum type.
  }
}
