import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `categoria` column to `movimientos`.
 *
 * Orthogonal axis to `concepto` for reporting: insumos, comida, transporte,
 * alquiler, servicios, material_didactico, mantenimiento, otros.
 *
 * Nullable so historical rows and non-applicable movements stay valid.
 */
export class AddCategoriaToMovimientos1713100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "movimientos_categoria_enum" AS ENUM (
        'insumos',
        'comida',
        'transporte',
        'alquiler',
        'servicios',
        'material_didactico',
        'mantenimiento',
        'otros'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE movimientos
      ADD COLUMN categoria "movimientos_categoria_enum" NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE movimientos DROP COLUMN IF EXISTS categoria
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "movimientos_categoria_enum"
    `);
  }
}
