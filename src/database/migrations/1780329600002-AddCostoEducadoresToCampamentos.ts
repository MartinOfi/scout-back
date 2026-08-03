import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCostoEducadoresToCampamentos1780329600002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "campamentos" ADD COLUMN "costoEducadores" decimal(10,2) NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campamentos" DROP COLUMN "costoEducadores"`,
    );
  }
}
