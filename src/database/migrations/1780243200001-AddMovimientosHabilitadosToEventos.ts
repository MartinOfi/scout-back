import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds eventos.movimientos_habilitados — the irreversible flag that gates
 * whether a VENTA event's ventas generate income movimientos.
 *
 * New events start false (movimientos deshabilitados). Existing VENTA events
 * are set to true so their current behaviour (ventas generate movimientos) is
 * preserved; otherwise loading new ventas on a pre-existing event would stop
 * producing movimientos after this migration.
 */
export class AddMovimientosHabilitadosToEventos1780243200001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "eventos"
      ADD COLUMN "movimientos_habilitados" BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      UPDATE "eventos"
      SET "movimientos_habilitados" = true
      WHERE "tipo" = 'venta'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "eventos"
      DROP COLUMN "movimientos_habilitados"
    `);
  }
}
