import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampamentoParticipanteExplicit1777248000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "campamento_participante" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "campamento_id" uuid NOT NULL,
        "persona_id" uuid NOT NULL,
        "autorizacion_entregada" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMPTZ,
        CONSTRAINT "pk_campamento_participante" PRIMARY KEY ("id"),
        CONSTRAINT "fk_cp_campamento"
          FOREIGN KEY ("campamento_id") REFERENCES "campamentos"("id"),
        CONSTRAINT "fk_cp_persona"
          FOREIGN KEY ("persona_id") REFERENCES "personas"("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_cp_active"
      ON "campamento_participante" ("campamento_id", "persona_id")
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO "campamento_participante"
        ("campamento_id", "persona_id", "autorizacion_entregada", "createdAt", "updatedAt")
      SELECT
        "campamento_id",
        "persona_id",
        false,
        now(),
        now()
      FROM "campamento_participantes"
    `);

    await queryRunner.query(`DROP TABLE "campamento_participantes"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "campamento_participantes" (
        "campamento_id" uuid NOT NULL,
        "persona_id" uuid NOT NULL,
        CONSTRAINT "pk_campamento_participantes"
          PRIMARY KEY ("campamento_id", "persona_id"),
        CONSTRAINT "fk_cp_old_campamento"
          FOREIGN KEY ("campamento_id") REFERENCES "campamentos"("id")
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "fk_cp_old_persona"
          FOREIGN KEY ("persona_id") REFERENCES "personas"("id")
          ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "campamento_participantes" ("campamento_id", "persona_id")
      SELECT "campamento_id", "persona_id"
      FROM "campamento_participante"
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`DROP TABLE "campamento_participante"`);
  }
}
