import { QueryRunner } from 'typeorm';
import { RemoveCuotas1780416000100 } from '../migrations/1780416000100-RemoveCuotas';

interface FakeDb {
  movimientosCuotaGrupo: number;
  cuotas: number;
  conceptoLabels: string[];
  movimientosConCuotaId?: number;
  cuotasTableExists?: boolean;
  cuotaIdColumnExists?: boolean;
}

function buildQueryRunner(db: FakeDb): {
  queryRunner: QueryRunner;
  executed: string[];
} {
  const executed: string[] = [];
  const query = jest.fn((sql: string) => {
    executed.push(sql);
    if (sql.includes(`"concepto"::text = 'cuota_grupo'`)) {
      return Promise.resolve([{ n: db.movimientosCuotaGrupo }]);
    }
    if (sql.includes('"cuota_id" IS NOT NULL')) {
      return Promise.resolve([{ n: db.movimientosConCuotaId ?? 0 }]);
    }
    if (sql.includes('FROM "cuotas"')) {
      return Promise.resolve([{ n: db.cuotas }]);
    }
    if (sql.includes('FROM pg_enum')) {
      return Promise.resolve(db.conceptoLabels.map((label) => ({ label })));
    }
    return Promise.resolve([]);
  });
  const hasTable = jest.fn(() => Promise.resolve(db.cuotasTableExists ?? true));
  const hasColumn = jest.fn(() =>
    Promise.resolve(db.cuotaIdColumnExists ?? true),
  );
  return {
    queryRunner: { query, hasTable, hasColumn } as unknown as QueryRunner,
    executed,
  };
}

const LABELS = ['inscripcion_grupo', 'cuota_grupo', 'gasto_general'];

describe('RemoveCuotas1780416000100', () => {
  const migration = new RemoveCuotas1780416000100();

  it('aborta sin tocar el schema si hay movimientos cuota_grupo', async () => {
    const { queryRunner, executed } = buildQueryRunner({
      movimientosCuotaGrupo: 2,
      cuotas: 0,
      conceptoLabels: LABELS,
    });

    await expect(migration.up(queryRunner)).rejects.toThrow(
      /2 movimiento\(s\) con concepto 'cuota_grupo'/,
    );
    expect(executed.some((sql) => /DROP|ALTER/.test(sql))).toBe(false);
  });

  it('aborta si la tabla cuotas tiene filas', async () => {
    const { queryRunner } = buildQueryRunner({
      movimientosCuotaGrupo: 0,
      cuotas: 1,
      conceptoLabels: LABELS,
    });

    await expect(migration.up(queryRunner)).rejects.toThrow(/1 cuota\(s\)/);
  });

  it('aborta si hay movimientos con cuota_id aunque su concepto no sea cuota_grupo', async () => {
    const { queryRunner, executed } = buildQueryRunner({
      movimientosCuotaGrupo: 0,
      movimientosConCuotaId: 3,
      cuotas: 0,
      conceptoLabels: LABELS,
    });

    await expect(migration.up(queryRunner)).rejects.toThrow(
      /3 movimiento\(s\) con cuota_id/,
    );
    expect(executed.some((sql) => /DROP|ALTER/.test(sql))).toBe(false);
  });

  it('no consulta tabla ni columna que no existen (Postgres falla al parsear)', async () => {
    const { queryRunner, executed } = buildQueryRunner({
      movimientosCuotaGrupo: 0,
      cuotas: 0,
      conceptoLabels: LABELS,
      cuotasTableExists: false,
      cuotaIdColumnExists: false,
    });

    await migration.up(queryRunner);

    expect(executed.some((sql) => sql.includes('FROM "cuotas"'))).toBe(false);
    expect(executed.some((sql) => sql.includes('"cuota_id" IS NOT NULL'))).toBe(
      false,
    );
  });

  it('recrea el enum de concepto sin cuota_grupo, conservando el resto', async () => {
    const { queryRunner, executed } = buildQueryRunner({
      movimientosCuotaGrupo: 0,
      cuotas: 0,
      conceptoLabels: LABELS,
    });

    await migration.up(queryRunner);

    const create = executed.find((sql) =>
      sql.startsWith('CREATE TYPE "movimientos_concepto_enum"'),
    );
    expect(create).toContain("'inscripcion_grupo', 'gasto_general'");
    expect(create).not.toContain('cuota_grupo');
    expect(executed.join('\n')).toContain('DROP TABLE IF EXISTS "cuotas"');
    expect(executed.join('\n')).toContain('DROP COLUMN IF EXISTS "cuota_id"');
    expect(executed.join('\n')).toContain(
      'DROP TYPE "movimientos_concepto_enum_old"',
    );
  });

  it('no recrea el enum si cuota_grupo ya no existe (idempotente)', async () => {
    const { queryRunner, executed } = buildQueryRunner({
      movimientosCuotaGrupo: 0,
      cuotas: 0,
      conceptoLabels: ['inscripcion_grupo', 'gasto_general'],
    });

    await migration.up(queryRunner);

    expect(executed.some((sql) => sql.includes('RENAME TO'))).toBe(false);
  });

  it('down restaura cuota_grupo, la tabla cuotas y la columna cuota_id', async () => {
    const { queryRunner, executed } = buildQueryRunner({
      movimientosCuotaGrupo: 0,
      cuotas: 0,
      conceptoLabels: [],
    });

    await migration.down(queryRunner);

    const all = executed.join('\n');
    expect(all).toContain("ADD VALUE IF NOT EXISTS 'cuota_grupo'");
    expect(all).toContain('CREATE TABLE "cuotas"');
    expect(all).toContain('ADD COLUMN IF NOT EXISTS "cuota_id" uuid');
  });
});
