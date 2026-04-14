import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const EXPORTED_TABLES_IN_FK_ORDER = [
  'personas',
  'cajas',
  'eventos',
  'productos',
  'inscripciones',
  'cuotas',
  'campamentos',
  'campamento_participantes',
  'movimientos',
  'ventas_productos',
] as const;

interface ColumnInfoRow {
  column_name: string;
}

@Injectable()
export class SqlDataExportService {
  private readonly logger = new Logger(SqlDataExportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async generateDump(): Promise<string> {
    const parts: string[] = [];

    parts.push('-- Scout database data export');
    parts.push(`-- Generated: ${new Date().toISOString()}`);
    parts.push(
      '-- Only data (INSERTs). Destination database must already have the schema.',
    );
    parts.push('');
    parts.push('-- To wipe existing data before restoring, uncomment the TRUNCATE below.');
    parts.push(
      `-- TRUNCATE ${EXPORTED_TABLES_IN_FK_ORDER.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`,
    );
    parts.push('');
    parts.push('BEGIN;');
    parts.push('');
    parts.push('SET session_replication_role = replica;');
    parts.push('');

    for (const table of EXPORTED_TABLES_IN_FK_ORDER) {
      const tableSql = await this.buildTableSection(table);
      parts.push(tableSql);
      parts.push('');
    }

    parts.push('SET session_replication_role = DEFAULT;');
    parts.push('');
    parts.push('COMMIT;');
    parts.push('');

    return parts.join('\n');
  }

  private async buildTableSection(table: string): Promise<string> {
    const columns = await this.getTableColumns(table);
    if (columns.length === 0) {
      this.logger.warn(`Table "${table}" has no columns in information_schema`);
      return `-- Table "${table}" has no columns (skipped)`;
    }

    const selectList = columns.map((c) => `"${c}"`).join(', ');
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT ${selectList} FROM "${table}"`,
    );

    if (rows.length === 0) {
      return `-- Table "${table}": empty`;
    }

    const valuesLines = rows.map((row) => {
      const vals = columns.map((c) => this.formatValue(row[c]));
      return `  (${vals.join(', ')})`;
    });

    return [
      `-- Table "${table}": ${rows.length} rows`,
      `INSERT INTO "${table}" (${selectList}) VALUES`,
      `${valuesLines.join(',\n')};`,
    ].join('\n');
  }

  private async getTableColumns(table: string): Promise<string[]> {
    const rows: ColumnInfoRow[] = await this.dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [table],
    );
    return rows.map((r) => r.column_name);
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : 'NULL';
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Date) {
      return `'${value.toISOString()}'`;
    }
    if (Buffer.isBuffer(value)) {
      return `'\\x${value.toString('hex')}'`;
    }
    if (typeof value === 'object') {
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    return `'${String(value).replace(/'/g, "''")}'`;
  }
}
