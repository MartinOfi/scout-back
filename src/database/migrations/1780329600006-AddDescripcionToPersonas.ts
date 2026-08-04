import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `personas.descripcion`, backing the `Colectivo` child entity
 * (`@ChildEntity(PersonaType.COLECTIVO)`) added in 1780329600001.
 *
 * Missing from that migration by mistake: the column was added to the local
 * Docker test DB by hand during development and the gap only surfaced when
 * running the e2e suite against Neon, where `Persona`'s STI SELECT (used by
 * every persona lookup, including auth) failed with
 * `column Persona.descripcion does not exist`.
 */
export class AddDescripcionToPersonas1780329600006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "personas"
      ADD COLUMN IF NOT EXISTS "descripcion" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "personas"
      DROP COLUMN IF EXISTS "descripcion"
    `);
  }
}
