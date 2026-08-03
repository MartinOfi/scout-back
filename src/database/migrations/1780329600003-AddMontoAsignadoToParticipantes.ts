import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Educators backfill to 0, not costoPorPersona: assigning them the full
 * cost would create retroactive debt for camps where they were never
 * expected to pay. At design time (2026-08-02) there were 0 educators
 * registered as participants — verified against the real database before
 * running this — so the CASE is defensive, not corrective.
 */
export class AddMontoAsignadoToParticipantes1780329600003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campamento_participante"
      ADD COLUMN "montoAsignado" decimal(10,2),
      ADD COLUMN "montoBonificado" decimal(10,2) NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      UPDATE "campamento_participante" cp
      SET "montoAsignado" = CASE
            WHEN p.tipo = 'educador' THEN 0
            ELSE c."costoPorPersona"
          END
      FROM "campamentos" c, "personas" p
      WHERE cp.campamento_id = c.id AND cp.persona_id = p.id
    `);

    await queryRunner.query(`
      ALTER TABLE "campamento_participante" ALTER COLUMN "montoAsignado" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campamento_participante" DROP COLUMN "montoAsignado", DROP COLUMN "montoBonificado"
    `);
  }
}
