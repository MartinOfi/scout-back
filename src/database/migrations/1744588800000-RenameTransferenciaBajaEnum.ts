import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Renames the Postgres enum value `transferencia_baja` to
 * `transferencia_saldo_personal` on `movimientos_concepto_enum`.
 *
 * Pairs with the TypeScript enum rename in
 * `src/common/enums/index.ts` (`TRANSFERENCIA_BAJA` →
 * `TRANSFERENCIA_SALDO_PERSONAL`).
 *
 * Safe as a pure rename: no rows use the old value at the time this
 * migration is authored, so no data UPDATE is required. Uses
 * `ALTER TYPE ... RENAME VALUE`, available since Postgres 10.
 *
 * Both `up()` and `down()` are guarded with an `IF EXISTS` check on
 * `pg_enum` so they are idempotent and safe to re-run. This matters
 * because the rename may be applied manually against the deployed DB
 * before a migration runner is wired up; running the migration later
 * must not crash on a DB already in the target state.
 */
export class RenameTransferenciaBajaEnum1744588800000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'movimientos_concepto_enum'
            AND e.enumlabel = 'transferencia_baja'
        ) THEN
          ALTER TYPE "movimientos_concepto_enum"
            RENAME VALUE 'transferencia_baja' TO 'transferencia_saldo_personal';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'movimientos_concepto_enum'
            AND e.enumlabel = 'transferencia_saldo_personal'
        ) THEN
          ALTER TYPE "movimientos_concepto_enum"
            RENAME VALUE 'transferencia_saldo_personal' TO 'transferencia_baja';
        END IF;
      END $$;
    `);
  }
}
