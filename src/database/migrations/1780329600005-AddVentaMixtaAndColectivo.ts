import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foundations for mixed-modality sale events, collective sellers and
 * uncollected sales.
 *
 * Three additive changes, none of which touches a movimiento, a caja, an
 * amount or a balance:
 *
 * 1. `eventos.modalidad_venta` — whether every venta of the event shares one
 *    destino (UNICA, the existing behaviour) or each venta picks its own
 *    (MIXTA). Defaults to UNICA so existing events keep working unchanged.
 *
 * 2. `ventas_productos.destino_ganancia` — the destino moves from the event
 *    down to the venta. Back-filled from the parent event, which is a
 *    deterministic copy of a value that was already implicit: every existing
 *    venta keeps the exact destino it always had, and its movimientos are left
 *    untouched. SET NOT NULL afterwards turns the rule into an invariant the
 *    database defends on its own.
 *
 * 3. `ventas_productos.estado_cobro` — whether the money actually came in.
 *    Defaults to COBRADO, which is what every pre-existing venta was.
 *
 * Plus the `Agrupacion` persona ("Grupo Scout"), so that a sale made by the
 * group itself has a real vendedor instead of a stand-in member. `personas.tipo`
 * is a varchar discriminator, so the new Single Table Inheritance child needs
 * no type change — only the row.
 *
 * PRE-FLIGHT: aborts if any venta hangs off a VENTA event with a NULL
 * destinoGanancia (the invalid state documented in AUDIT_REPORT_EVENTOS.md).
 * Those must be resolved before migrating, otherwise the back-fill would leave
 * NULLs behind and SET NOT NULL would fail with a far less obvious error.
 */
export class AddVentaMixtaAndColectivo1780329600005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE huerfanas integer;
      BEGIN
        SELECT count(*) INTO huerfanas
        FROM "ventas_productos" v
        JOIN "eventos" e ON e."id" = v."evento_id"
        WHERE e."destinoGanancia" IS NULL;

        IF huerfanas > 0 THEN
          RAISE EXCEPTION
            'PRE-FLIGHT: % ventas pertenecen a eventos sin destinoGanancia. Resolver ese estado invalido (ver AUDIT_REPORT_EVENTOS.md) antes de migrar.',
            huerfanas;
        END IF;
      END $$;
    `);

    // 1. eventos.modalidad_venta
    await queryRunner.query(`
      CREATE TYPE "eventos_modalidad_venta_enum" AS ENUM ('unica', 'mixta')
    `);
    await queryRunner.query(`
      ALTER TABLE "eventos"
      ADD COLUMN "modalidad_venta" "eventos_modalidad_venta_enum"
      NOT NULL DEFAULT 'unica'
    `);

    // 2. ventas_productos.destino_ganancia (nullable -> back-fill -> NOT NULL)
    await queryRunner.query(`
      CREATE TYPE "ventas_productos_destino_ganancia_enum"
      AS ENUM ('cuentas_personales', 'caja_grupo')
    `);
    await queryRunner.query(`
      ALTER TABLE "ventas_productos"
      ADD COLUMN "destino_ganancia" "ventas_productos_destino_ganancia_enum"
    `);
    await queryRunner.query(`
      UPDATE "ventas_productos" v
      SET "destino_ganancia" =
        e."destinoGanancia"::text::"ventas_productos_destino_ganancia_enum"
      FROM "eventos" e
      WHERE e."id" = v."evento_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "ventas_productos"
      ALTER COLUMN "destino_ganancia" SET NOT NULL
    `);

    // 3. ventas_productos.estado_cobro
    await queryRunner.query(`
      CREATE TYPE "ventas_productos_estado_cobro_enum"
      AS ENUM ('cobrado', 'pendiente')
    `);
    await queryRunner.query(`
      ALTER TABLE "ventas_productos"
      ADD COLUMN "estado_cobro" "ventas_productos_estado_cobro_enum"
      NOT NULL DEFAULT 'cobrado'
    `);

    // 4. Agrupacion "Grupo Scout" — idempotent
    await queryRunner.query(`
      INSERT INTO "personas" ("id", "tipo", "nombre", "estado", "emailVerified")
      SELECT gen_random_uuid(), 'agrupacion', 'Grupo Scout', 'activo', false
      WHERE NOT EXISTS (
        SELECT 1 FROM "personas" WHERE "tipo" = 'agrupacion'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only removes agrupaciones nobody sold through, so reverting can never
    // orphan a venta. An agrupacion with ventas is left in place on purpose.
    await queryRunner.query(`
      DELETE FROM "personas" p
      WHERE p."tipo" = 'agrupacion'
        AND NOT EXISTS (
          SELECT 1 FROM "ventas_productos" v WHERE v."vendedor_id" = p."id"
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "ventas_productos" DROP COLUMN "estado_cobro"
    `);
    await queryRunner.query(`
      DROP TYPE "ventas_productos_estado_cobro_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "ventas_productos" DROP COLUMN "destino_ganancia"
    `);
    await queryRunner.query(`
      DROP TYPE "ventas_productos_destino_ganancia_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "eventos" DROP COLUMN "modalidad_venta"
    `);
    await queryRunner.query(`
      DROP TYPE "eventos_modalidad_venta_enum"
    `);
  }
}
