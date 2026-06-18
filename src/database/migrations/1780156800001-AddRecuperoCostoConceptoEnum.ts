import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the new ConceptoMovimiento value `evento_venta_recupero_costo` to the
 * Postgres enum type backing the `movimientos.concepto` column.
 *
 * The TypeScript enum already lists it, but Postgres enum types are part of the
 * schema: the value must be added with ALTER TYPE or any INSERT using it fails
 * with `invalid input value for enum movimientos_concepto_enum`.
 *
 * Separate from the column migration (1780156800000) because that one already
 * ran in environments where the column exists but the enum value was missing.
 *
 * NOTE: Postgres cannot DROP an enum value, so down() is intentionally a no-op.
 */
export class AddRecuperoCostoConceptoEnum1780156800001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "movimientos_concepto_enum"
      ADD VALUE IF NOT EXISTS 'evento_venta_recupero_costo'
    `);
  }

  public async down(): Promise<void> {
    // Postgres does not support removing a value from an enum type.
    // Leaving the value in place is harmless and reversible-safe.
  }
}
