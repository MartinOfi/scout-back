import * as ExcelJS from 'exceljs';

import { WorkbookBuilderService, SheetSpec } from './workbook-builder.service';

describe('WorkbookBuilderService', () => {
  let service: WorkbookBuilderService;

  beforeEach(() => {
    service = new WorkbookBuilderService();
  });

  async function readBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    return wb;
  }

  it('produces a non-empty buffer', async () => {
    const buffer = await service.build([
      {
        name: 'Sheet1',
        columns: [{ header: 'A', key: 'a' }],
        rows: [{ a: 1 }],
      },
    ]);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('creates one worksheet per SheetSpec, preserving names and order', async () => {
    const specs: SheetSpec[] = [
      {
        name: 'Personas',
        columns: [{ header: 'Nombre', key: 'nombre' }],
        rows: [],
      },
      { name: 'Cajas', columns: [{ header: 'Tipo', key: 'tipo' }], rows: [] },
      {
        name: 'Movimientos',
        columns: [{ header: 'Monto', key: 'monto' }],
        rows: [],
      },
    ];

    const buffer = await service.build(specs);
    const wb = await readBuffer(buffer);

    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Personas',
      'Cajas',
      'Movimientos',
    ]);
  });

  it('writes headers as the first row and rows below', async () => {
    const buffer = await service.build([
      {
        name: 'Personas',
        columns: [
          { header: 'Nombre', key: 'nombre' },
          { header: 'Email', key: 'email' },
        ],
        rows: [
          { nombre: 'Juan', email: 'juan@scout.com' },
          { nombre: 'María', email: 'maria@scout.com' },
        ],
      },
    ]);

    const wb = await readBuffer(buffer);
    const ws = wb.getWorksheet('Personas');
    expect(ws).toBeDefined();
    if (!ws) return;

    expect(ws.getRow(1).getCell(1).value).toBe('Nombre');
    expect(ws.getRow(1).getCell(2).value).toBe('Email');
    expect(ws.getRow(2).getCell(1).value).toBe('Juan');
    expect(ws.getRow(2).getCell(2).value).toBe('juan@scout.com');
    expect(ws.getRow(3).getCell(1).value).toBe('María');
  });

  it('makes header row bold and frozen', async () => {
    const buffer = await service.build([
      { name: 'X', columns: [{ header: 'H', key: 'h' }], rows: [{ h: 1 }] },
    ]);

    const wb = await readBuffer(buffer);
    const ws = wb.getWorksheet('X');
    if (!ws) throw new Error('worksheet missing');

    expect(ws.getRow(1).font?.bold).toBe(true);
    const view = ws.views?.[0] as
      | { state?: string; ySplit?: number }
      | undefined;
    expect(view?.state).toBe('frozen');
    expect(view?.ySplit).toBe(1);
  });

  it('enables autofilter over the header range', async () => {
    const buffer = await service.build([
      {
        name: 'X',
        columns: [
          { header: 'A', key: 'a' },
          { header: 'B', key: 'b' },
        ],
        rows: [{ a: 1, b: 2 }],
      },
    ]);

    const wb = await readBuffer(buffer);
    const ws = wb.getWorksheet('X');
    if (!ws) throw new Error('worksheet missing');

    expect(ws.autoFilter).toBeDefined();
  });

  it('formats currency columns with money format', async () => {
    const buffer = await service.build([
      {
        name: 'Movimientos',
        columns: [{ header: 'Monto', key: 'monto', type: 'currency' }],
        rows: [{ monto: 1500.5 }],
      },
    ]);

    const wb = await readBuffer(buffer);
    const ws = wb.getWorksheet('Movimientos');
    if (!ws) throw new Error('worksheet missing');

    const cell = ws.getRow(2).getCell(1);
    expect(cell.numFmt).toMatch(/\$/);
    expect(cell.value).toBe(1500.5);
  });

  it('formats date columns with a date number format', async () => {
    const buffer = await service.build([
      {
        name: 'Movimientos',
        columns: [{ header: 'Fecha', key: 'fecha', type: 'date' }],
        rows: [{ fecha: new Date('2026-04-14T12:00:00Z') }],
      },
    ]);

    const wb = await readBuffer(buffer);
    const ws = wb.getWorksheet('Movimientos');
    if (!ws) throw new Error('worksheet missing');

    const cell = ws.getRow(2).getCell(1);
    expect(cell.numFmt).toMatch(/dd|yyyy/i);
    expect(cell.value).toBeInstanceOf(Date);
  });

  it('renders boolean values as Sí/No strings', async () => {
    const buffer = await service.build([
      {
        name: 'Inscripciones',
        columns: [
          { header: 'DNI', key: 'dni', type: 'boolean' },
          { header: 'Foto', key: 'foto', type: 'boolean' },
        ],
        rows: [
          { dni: true, foto: false },
          { dni: false, foto: true },
        ],
      },
    ]);

    const wb = await readBuffer(buffer);
    const ws = wb.getWorksheet('Inscripciones');
    if (!ws) throw new Error('worksheet missing');

    expect(ws.getRow(2).getCell(1).value).toBe('Sí');
    expect(ws.getRow(2).getCell(2).value).toBe('No');
    expect(ws.getRow(3).getCell(1).value).toBe('No');
    expect(ws.getRow(3).getCell(2).value).toBe('Sí');
  });

  it('writes empty cells for null/undefined values', async () => {
    const buffer = await service.build([
      {
        name: 'X',
        columns: [
          { header: 'Nombre', key: 'nombre' },
          { header: 'Email', key: 'email' },
        ],
        rows: [{ nombre: 'Juan', email: null }],
      },
    ]);

    const wb = await readBuffer(buffer);
    const ws = wb.getWorksheet('X');
    if (!ws) throw new Error('worksheet missing');

    const cell = ws.getRow(2).getCell(2);
    expect(cell.value === null || cell.value === undefined).toBe(true);
  });

  it('produces a valid sheet when rows is empty', async () => {
    const buffer = await service.build([
      {
        name: 'Vacia',
        columns: [{ header: 'A', key: 'a' }],
        rows: [],
      },
    ]);

    const wb = await readBuffer(buffer);
    const ws = wb.getWorksheet('Vacia');
    if (!ws) throw new Error('worksheet missing');

    expect(ws.getRow(1).getCell(1).value).toBe('A');
  });

  it('truncates sheet names to the 31 character Excel limit', async () => {
    const longName = 'NombreDeHojaExageradamenteLargoQueExcedeElLimite';
    const buffer = await service.build([
      { name: longName, columns: [{ header: 'A', key: 'a' }], rows: [] },
    ]);

    const wb = await readBuffer(buffer);
    expect(wb.worksheets[0].name.length).toBeLessThanOrEqual(31);
  });
});
