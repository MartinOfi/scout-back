import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { SqlDataExportService } from './sql-data-export.service';

interface TableFixture {
  columns: string[];
  rows: Record<string, unknown>[];
}

type Schema = Record<string, TableFixture>;

function buildQueryMock(schema: Schema): jest.Mock {
  return jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('information_schema.columns')) {
      const tableName = params?.[0] as string;
      const table = schema[tableName];
      if (!table) return [];
      return table.columns.map((c) => ({ column_name: c }));
    }
    for (const [tableName, table] of Object.entries(schema)) {
      if (sql.includes(`FROM "${tableName}"`)) {
        return table.rows;
      }
    }
    return [];
  });
}

describe('SqlDataExportService', () => {
  let service: SqlDataExportService;
  let dataSource: { query: jest.Mock };

  async function bootstrap(schema: Schema): Promise<void> {
    dataSource = { query: buildQueryMock(schema) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqlDataExportService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();
    service = module.get(SqlDataExportService);
  }

  describe('generateDump', () => {
    it('wraps output in BEGIN / COMMIT and toggles session_replication_role', async () => {
      await bootstrap({});
      const sql = await service.generateDump();

      expect(sql).toMatch(/BEGIN;/);
      expect(sql).toMatch(/COMMIT;/);
      expect(sql).toMatch(/SET session_replication_role = replica;/);
      expect(sql).toMatch(/SET session_replication_role = DEFAULT;/);
      expect(sql.indexOf('BEGIN;')).toBeLessThan(
        sql.indexOf('SET session_replication_role = replica;'),
      );
      expect(
        sql.indexOf('SET session_replication_role = DEFAULT;'),
      ).toBeLessThan(sql.indexOf('COMMIT;'));
    });

    it('emits a generation timestamp header comment', async () => {
      await bootstrap({});
      const sql = await service.generateDump();
      expect(sql).toMatch(/-- Scout database data export/i);
      expect(sql).toMatch(/-- Generated: \d{4}-\d{2}-\d{2}T/);
    });

    it('exports tables in a foreign-key-safe order', async () => {
      await bootstrap({});
      const sql = await service.generateDump();

      const order = [
        'personas',
        'cajas',
        'eventos',
        'productos',
        'inscripciones',
        'cuotas',
        'campamentos',
        'campamento_participante',
        'movimientos',
        'ventas_productos',
      ];

      let lastIndex = -1;
      for (const table of order) {
        const marker = `-- Table "${table}"`;
        const idx = sql.indexOf(marker);
        expect(idx).toBeGreaterThan(lastIndex);
        lastIndex = idx;
      }
    });

    it('does not export refresh_tokens (security)', async () => {
      await bootstrap({
        refresh_tokens: {
          columns: ['id', 'token'],
          rows: [{ id: 'r1', token: 'secret' }],
        },
      });
      const sql = await service.generateDump();
      expect(sql).not.toContain('refresh_tokens');
      expect(sql).not.toContain('secret');
    });

    it('emits a comment (not an INSERT) for empty tables', async () => {
      await bootstrap({
        personas: { columns: ['id', 'nombre'], rows: [] },
      });
      const sql = await service.generateDump();
      expect(sql).toMatch(/-- Table "personas": empty/);
      expect(sql).not.toMatch(/INSERT INTO "personas"/);
    });

    it('emits a multi-row INSERT for populated tables', async () => {
      await bootstrap({
        personas: {
          columns: ['id', 'nombre'],
          rows: [
            { id: 'p1', nombre: 'Juan' },
            { id: 'p2', nombre: 'Ana' },
          ],
        },
      });
      const sql = await service.generateDump();
      expect(sql).toMatch(/INSERT INTO "personas" \("id", "nombre"\) VALUES/);
      expect(sql).toContain("('p1', 'Juan')");
      expect(sql).toContain("('p2', 'Ana')");
    });

    it('escapes single quotes in string values by doubling them', async () => {
      await bootstrap({
        personas: {
          columns: ['id', 'nombre'],
          rows: [{ id: 'p1', nombre: "D'Angelo" }],
        },
      });
      const sql = await service.generateDump();
      expect(sql).toContain("('p1', 'D''Angelo')");
    });

    it('formats null as NULL (unquoted)', async () => {
      await bootstrap({
        personas: {
          columns: ['id', 'email'],
          rows: [{ id: 'p1', email: null }],
        },
      });
      const sql = await service.generateDump();
      expect(sql).toContain("('p1', NULL)");
    });

    it('formats booleans as true/false', async () => {
      await bootstrap({
        personas: {
          columns: ['id', 'dni'],
          rows: [
            { id: 'p1', dni: true },
            { id: 'p2', dni: false },
          ],
        },
      });
      const sql = await service.generateDump();
      expect(sql).toContain("('p1', true)");
      expect(sql).toContain("('p2', false)");
    });

    it('formats numbers without quotes', async () => {
      await bootstrap({
        cuotas: {
          columns: ['id', 'ano', 'montoTotal'],
          rows: [{ id: 'q1', ano: 2026, montoTotal: 1500.5 }],
        },
      });
      const sql = await service.generateDump();
      expect(sql).toContain("('q1', 2026, 1500.5)");
    });

    it('formats Date values as ISO strings', async () => {
      await bootstrap({
        movimientos: {
          columns: ['id', 'fecha'],
          rows: [{ id: 'm1', fecha: new Date('2026-04-14T12:00:00.000Z') }],
        },
      });
      const sql = await service.generateDump();
      expect(sql).toContain("'2026-04-14T12:00:00.000Z'");
    });

    it('serializes objects/arrays as JSON strings', async () => {
      await bootstrap({
        personas: {
          columns: ['id', 'meta'],
          rows: [{ id: 'p1', meta: { foo: 'bar', n: 1 } }],
        },
      });
      const sql = await service.generateDump();
      expect(sql).toContain(`'{"foo":"bar","n":1}'`);
    });

    it('includes an optional commented TRUNCATE block for restore hints', async () => {
      await bootstrap({});
      const sql = await service.generateDump();
      expect(sql).toMatch(/-- To wipe existing data before restoring/i);
      expect(sql).toMatch(/-- TRUNCATE /);
    });
  });
});
