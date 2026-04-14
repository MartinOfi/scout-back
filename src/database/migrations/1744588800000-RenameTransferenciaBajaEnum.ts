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
 */
export class RenameTransferenciaBajaEnum1744588800000
  implements MigrationInterface
{
  name = 'RenameTransferenciaBajaEnum1744588800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "movimientos_concepto_enum" RENAME VALUE 'transferencia_baja' TO 'transferencia_saldo_personal'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "movimientos_concepto_enum" RENAME VALUE 'transferencia_saldo_personal' TO 'transferencia_baja'`,
    );
  }
}
