import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportePublicoToEventos1780070400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "eventos"
      ADD COLUMN "reporte_publico" BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "eventos"
      DROP COLUMN "reporte_publico"
    `);
  }
}
