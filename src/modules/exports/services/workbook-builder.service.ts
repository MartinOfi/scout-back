import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export type CellType = 'string' | 'number' | 'currency' | 'date' | 'boolean';

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
  type?: CellType;
}

export interface SheetSpec {
  name: string;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
}

const EXCEL_SHEET_NAME_LIMIT = 31;
const CURRENCY_FORMAT = '"$"#,##0.00';
const DATE_FORMAT = 'dd/mm/yyyy';
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true };
const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFEFEFEF' },
};

@Injectable()
export class WorkbookBuilderService {
  async build(specs: SheetSpec[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Scout';
    workbook.created = new Date();

    for (const spec of specs) {
      this.addSheet(workbook, spec);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  private addSheet(workbook: ExcelJS.Workbook, spec: SheetSpec): void {
    const sheetName = spec.name.slice(0, EXCEL_SHEET_NAME_LIMIT);
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = spec.columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width ?? this.defaultWidthFor(col),
    }));

    const headerRow = sheet.getRow(1);
    headerRow.font = HEADER_FONT;
    headerRow.fill = HEADER_FILL;

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const row of spec.rows) {
      sheet.addRow(this.transformRow(row, spec.columns));
    }

    this.applyColumnFormats(sheet, spec.columns);

    if (spec.columns.length > 0) {
      const lastColLetter = sheet.getColumn(spec.columns.length).letter;
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: spec.columns.length },
      };
      void lastColLetter;
    }
  }

  private transformRow(
    row: Record<string, unknown>,
    columns: ColumnDef[],
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      const value = row[col.key];
      if (col.type === 'boolean') {
        if (value === null || value === undefined) {
          out[col.key] = null;
        } else {
          out[col.key] = value ? 'Sí' : 'No';
        }
      } else {
        out[col.key] = value ?? null;
      }
    }
    return out;
  }

  private applyColumnFormats(
    sheet: ExcelJS.Worksheet,
    columns: ColumnDef[],
  ): void {
    columns.forEach((col, index) => {
      const colNumber = index + 1;
      const sheetCol = sheet.getColumn(colNumber);
      if (col.type === 'currency') {
        sheetCol.numFmt = CURRENCY_FORMAT;
      } else if (col.type === 'date') {
        sheetCol.numFmt = DATE_FORMAT;
      }
    });
  }

  private defaultWidthFor(col: ColumnDef): number {
    switch (col.type) {
      case 'date':
        return 14;
      case 'currency':
      case 'number':
        return 14;
      case 'boolean':
        return 8;
      default:
        return Math.max(12, col.header.length + 2);
    }
  }
}
