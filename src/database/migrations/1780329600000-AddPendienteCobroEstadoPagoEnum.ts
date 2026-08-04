import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the new EstadoPago value `pendiente_cobro` to the Postgres enum type
 * backing the `movimientos.estadoPago` column.
 *
 * It marks an INGRESO that was recorded but not collected yet (typically a
 * WhatsApp order), the mirror image of `pendiente_reembolso` for egresos.
 * MovimientosService.calcularSaldo excludes it, so the caja balance never
 * reflects money that has not come in.
 *
 * Kept in its own migration, apart from 1780329600001 which adds the columns:
 * Postgres does not allow a value added by ALTER TYPE ... ADD VALUE to be used
 * inside the same transaction. Splitting them keeps the follow-up migration
 * free to reference the value if it ever needs to. Same reasoning as
 * 1780156800001-AddRecuperoCostoConceptoEnum.
 *
 * NOTE: Postgres cannot DROP an enum value, so down() is intentionally a no-op.
 */
export class AddPendienteCobroEstadoPagoEnum1780329600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "movimientos_estadopago_enum"
      ADD VALUE IF NOT EXISTS 'pendiente_cobro'
    `);
  }

  public async down(): Promise<void> {
    // Postgres does not support removing a value from an enum type.
    // Leaving the value in place is harmless and reversible-safe.
  }
}
