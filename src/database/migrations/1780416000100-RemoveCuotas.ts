import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the Cuotas feature (PRD F9), which was never reachable from the UI:
 * - drops the `cuotas` table and its `cuotas_estado_enum` type
 * - drops `movimientos.cuota_id`
 * - removes `cuota_grupo` from `movimientos_concepto_enum`
 *
 * Postgres cannot DROP an enum value, so the concepto type is recreated: the
 * old one is renamed, a new one is built from its current labels minus
 * `cuota_grupo` (read from pg_enum, so values added by other migrations are
 * kept), the column is cast over and the old type dropped.
 *
 * Guard: aborts if any row still references cuotas — including soft-deleted
 * movimientos, which the API hides but the enum cast would still trip on.
 * Remap or delete those rows explicitly before running this migration.
 *
 * down() restores the schema, not the data. Two cosmetic differences with the
 * original: PK/FK constraint names (originals were TypeORM hashes) and
 * `cuota_grupo` is appended at the end of the enum instead of its original
 * position. `cuota_id` never had a FK and `cuotas` had no secondary indexes.
 */
const CONCEPTO_ENUM = 'movimientos_concepto_enum';
const CONCEPTO_ENUM_OLD = 'movimientos_concepto_enum_old';
const CUOTA_GRUPO = 'cuota_grupo';

export class RemoveCuotas1780416000100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.assertNoCuotaData(queryRunner);

    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP COLUMN IF EXISTS "cuota_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cuotas"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "cuotas_estado_enum"`);

    await this.removeCuotaGrupoFromConceptoEnum(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "${CONCEPTO_ENUM}" ADD VALUE IF NOT EXISTS '${CUOTA_GRUPO}'
    `);
    await queryRunner.query(`
      CREATE TYPE "cuotas_estado_enum" AS ENUM ('pendiente', 'parcial', 'pagado')
    `);
    await queryRunner.query(`
      CREATE TABLE "cuotas" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "persona_id" uuid NOT NULL,
        "nombre" varchar(100) NOT NULL,
        "ano" integer NOT NULL,
        "montoTotal" decimal(10,2) NOT NULL,
        "montoPagado" decimal(10,2) NOT NULL DEFAULT 0,
        "estado" "cuotas_estado_enum" NOT NULL DEFAULT 'pendiente',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMPTZ,
        CONSTRAINT "pk_cuotas" PRIMARY KEY ("id"),
        CONSTRAINT "fk_cuotas_persona"
          FOREIGN KEY ("persona_id") REFERENCES "personas"("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD COLUMN IF NOT EXISTS "cuota_id" uuid`,
    );
  }

  /**
   * Each count runs only if its table/column exists: Postgres resolves every
   * relation at parse time, so a CASE guard around a missing table still fails.
   */
  private async assertNoCuotaData(queryRunner: QueryRunner): Promise<void> {
    const movimientos = await this.count(
      queryRunner,
      `SELECT COUNT(*)::int AS n FROM "movimientos"
       WHERE "concepto"::text = '${CUOTA_GRUPO}'`,
    );
    const conCuotaId = (await queryRunner.hasColumn('movimientos', 'cuota_id'))
      ? await this.count(
          queryRunner,
          `SELECT COUNT(*)::int AS n FROM "movimientos" WHERE "cuota_id" IS NOT NULL`,
        )
      : 0;
    const cuotas = (await queryRunner.hasTable('cuotas'))
      ? await this.count(queryRunner, `SELECT COUNT(*)::int AS n FROM "cuotas"`)
      : 0;

    if (movimientos + conCuotaId + cuotas > 0) {
      throw new Error(
        `RemoveCuotas: abortado. Hay ${movimientos} movimiento(s) con concepto ` +
          `'${CUOTA_GRUPO}', ${conCuotaId} movimiento(s) con cuota_id y ` +
          `${cuotas} cuota(s) (incluye soft-deleted). ` +
          'Remapealos o borralos antes de correr esta migración.',
      );
    }
  }

  private async count(queryRunner: QueryRunner, sql: string): Promise<number> {
    const [{ n }] = (await queryRunner.query(sql)) as { n: number }[];
    return n;
  }

  private async removeCuotaGrupoFromConceptoEnum(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT e.enumlabel AS label
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = '${CONCEPTO_ENUM}'
      ORDER BY e.enumsortorder
    `)) as { label: string }[];

    const labels = rows.map((r) => r.label);
    if (!labels.includes(CUOTA_GRUPO)) return;

    const values = labels
      .filter((l) => l !== CUOTA_GRUPO)
      .map((l) => `'${l.replace(/'/g, "''")}'`)
      .join(', ');

    await queryRunner.query(
      `ALTER TYPE "${CONCEPTO_ENUM}" RENAME TO "${CONCEPTO_ENUM_OLD}"`,
    );
    await queryRunner.query(
      `CREATE TYPE "${CONCEPTO_ENUM}" AS ENUM (${values})`,
    );
    await queryRunner.query(`
      ALTER TABLE "movimientos"
      ALTER COLUMN "concepto" TYPE "${CONCEPTO_ENUM}"
      USING "concepto"::text::"${CONCEPTO_ENUM}"
    `);
    await queryRunner.query(`DROP TYPE "${CONCEPTO_ENUM_OLD}"`);
  }
}
