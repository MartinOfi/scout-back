import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEntregas1779984000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "entregas" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "evento_id" uuid NOT NULL,
        "vendedor_id" uuid NOT NULL,
        "fecha" TIMESTAMPTZ,
        "notas" TEXT,
        "registrado_por_id" uuid,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMPTZ,
        CONSTRAINT "pk_entregas" PRIMARY KEY ("id"),
        CONSTRAINT "fk_entregas_evento"
          FOREIGN KEY ("evento_id") REFERENCES "eventos"("id"),
        CONSTRAINT "fk_entregas_vendedor"
          FOREIGN KEY ("vendedor_id") REFERENCES "personas"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_entregas_evento"
      ON "entregas" ("evento_id")
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_entregas_evento_vendedor"
      ON "entregas" ("evento_id", "vendedor_id")
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "entregas_lineas" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "entrega_id" uuid NOT NULL,
        "producto_id" uuid NOT NULL,
        "cantidad" int NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMPTZ,
        CONSTRAINT "pk_entregas_lineas" PRIMARY KEY ("id"),
        CONSTRAINT "fk_entregas_lineas_entrega"
          FOREIGN KEY ("entrega_id") REFERENCES "entregas"("id"),
        CONSTRAINT "fk_entregas_lineas_producto"
          FOREIGN KEY ("producto_id") REFERENCES "productos"("id"),
        CONSTRAINT "ck_entregas_lineas_cantidad_positive"
          CHECK ("cantidad" > 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_entregas_lineas_entrega"
      ON "entregas_lineas" ("entrega_id")
      WHERE "deletedAt" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "ix_entregas_lineas_producto"
      ON "entregas_lineas" ("producto_id")
      WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "entregas_lineas"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "entregas"`);
  }
}
