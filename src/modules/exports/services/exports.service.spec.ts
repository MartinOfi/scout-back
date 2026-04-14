import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { ExportsService } from './exports.service';
import { WorkbookBuilderService, SheetSpec } from './workbook-builder.service';

import { Persona } from '../../personas/entities/persona.entity';
import { Caja } from '../../cajas/entities/caja.entity';
import { Movimiento } from '../../movimientos/entities/movimiento.entity';
import { Inscripcion } from '../../inscripciones/entities/inscripcion.entity';
import { Cuota } from '../../cuotas/entities/cuota.entity';
import { Campamento } from '../../campamentos/entities/campamento.entity';
import { Evento } from '../../eventos/entities/evento.entity';
import { Producto } from '../../eventos/entities/producto.entity';
import { VentaProducto } from '../../eventos/entities/venta-producto.entity';

import {
  CajaType,
  ConceptoMovimiento,
  EstadoCuota,
  EstadoPago,
  EstadoPersona,
  MedioPago,
  PersonaType,
  TipoEvento,
  TipoInscripcion,
  TipoMovimiento,
} from '../../../common/enums';

type RepoMock<T extends ObjectLiteral> = Partial<jest.Mocked<Repository<T>>>;

function buildRepoMock<T extends ObjectLiteral>(rows: unknown[]): RepoMock<T> {
  return {
    find: jest.fn().mockResolvedValue(rows),
  };
}

const mockPersonas: Partial<Persona>[] = [
  {
    id: 'p1',
    nombre: 'Juan',
    tipo: PersonaType.PROTAGONISTA,
    estado: EstadoPersona.ACTIVO,
    email: null,
  },
  {
    id: 'p2',
    nombre: 'Ana',
    tipo: PersonaType.EDUCADOR,
    estado: EstadoPersona.ACTIVO,
    email: 'ana@scout.com',
  },
];

const mockCajas: Partial<Caja>[] = [
  {
    id: 'c1',
    tipo: CajaType.GRUPO,
    nombre: 'Caja Grupo',
    propietarioId: null,
  },
  {
    id: 'c2',
    tipo: CajaType.PERSONAL,
    nombre: 'Personal Juan',
    propietarioId: 'p1',
  },
];

const mockMovimientos: Partial<Movimiento>[] = [
  {
    id: 'm1',
    fecha: new Date('2026-04-01T10:00:00Z'),
    tipo: TipoMovimiento.INGRESO,
    monto: 1500,
    concepto: ConceptoMovimiento.CUOTA_GRUPO,
    medioPago: MedioPago.EFECTIVO,
    estadoPago: EstadoPago.PAGADO,
    cajaId: 'c1',
    responsableId: 'p1',
    descripcion: 'Pago cuota marzo',
  },
];

const mockInscripciones: Partial<Inscripcion>[] = [
  {
    id: 'i1',
    personaId: 'p1',
    tipo: TipoInscripcion.GRUPO,
    ano: 2026,
    montoTotal: 5000,
    montoBonificado: 0,
  },
];

const mockCuotas: Partial<Cuota>[] = [
  {
    id: 'q1',
    personaId: 'p1',
    nombre: 'Cuota Marzo 2026',
    ano: 2026,
    montoTotal: 1500,
    montoPagado: 1500,
    estado: EstadoCuota.PAGADO,
  },
];

const mockCampamentos: unknown[] = [
  {
    id: 'k1',
    nombre: 'Campamento Verano',
    fechaInicio: new Date('2026-01-15'),
    fechaFin: new Date('2026-01-20'),
    costoPorPersona: 8000,
    cuotasBase: 2,
    participantes: [
      { id: 'p1', nombre: 'Juan' },
      { id: 'p2', nombre: 'Ana' },
    ],
  },
];

const mockEventos: Partial<Evento>[] = [
  {
    id: 'e1',
    nombre: 'Venta empanadas',
    fecha: new Date('2026-05-01'),
    tipo: TipoEvento.VENTA,
    estaCerrado: false,
  },
];

const mockProductos: Partial<Producto>[] = [
  {
    id: 'pr1',
    eventoId: 'e1',
    nombre: 'Empanada de carne',
    precioCosto: 100,
    precioVenta: 250,
  },
];

const mockVentas: Partial<VentaProducto>[] = [
  {
    id: 'v1',
    eventoId: 'e1',
    productoId: 'pr1',
    vendedorId: 'p1',
    cantidad: 10,
  },
];

describe('ExportsService', () => {
  let service: ExportsService;
  let workbookBuilder: jest.Mocked<WorkbookBuilderService>;
  let capturedSpecs: SheetSpec[] = [];

  beforeEach(async () => {
    capturedSpecs = [];
    workbookBuilder = {
      build: jest.fn().mockImplementation(async (specs: SheetSpec[]) => {
        capturedSpecs = specs;
        return Buffer.from('fake-xlsx');
      }),
    } as unknown as jest.Mocked<WorkbookBuilderService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportsService,
        { provide: WorkbookBuilderService, useValue: workbookBuilder },
        {
          provide: getRepositoryToken(Persona),
          useValue: buildRepoMock(mockPersonas),
        },
        {
          provide: getRepositoryToken(Caja),
          useValue: buildRepoMock(mockCajas),
        },
        {
          provide: getRepositoryToken(Movimiento),
          useValue: buildRepoMock(mockMovimientos),
        },
        {
          provide: getRepositoryToken(Inscripcion),
          useValue: buildRepoMock(mockInscripciones),
        },
        {
          provide: getRepositoryToken(Cuota),
          useValue: buildRepoMock(mockCuotas),
        },
        {
          provide: getRepositoryToken(Campamento),
          useValue: buildRepoMock(mockCampamentos),
        },
        {
          provide: getRepositoryToken(Evento),
          useValue: buildRepoMock(mockEventos),
        },
        {
          provide: getRepositoryToken(Producto),
          useValue: buildRepoMock(mockProductos),
        },
        {
          provide: getRepositoryToken(VentaProducto),
          useValue: buildRepoMock(mockVentas),
        },
      ],
    }).compile();

    service = module.get(ExportsService);
  });

  describe('generateXlsx', () => {
    it('returns the buffer produced by the workbook builder', async () => {
      const result = await service.generateXlsx();
      expect(result).toEqual(Buffer.from('fake-xlsx'));
      expect(workbookBuilder.build).toHaveBeenCalledTimes(1);
    });

    it('produces exactly the 10 expected sheets in order', async () => {
      await service.generateXlsx();

      expect(capturedSpecs.map((s) => s.name)).toEqual([
        'Personas',
        'Cajas',
        'Movimientos',
        'Inscripciones',
        'Cuotas',
        'Campamentos',
        'CampamentoParticipantes',
        'Eventos',
        'Productos',
        'VentasProductos',
      ]);
    });

    it('enriches Movimientos rows with cajaNombre and responsableNombre', async () => {
      await service.generateXlsx();

      const movimientosSheet = capturedSpecs.find(
        (s) => s.name === 'Movimientos',
      );
      expect(movimientosSheet).toBeDefined();
      const row = movimientosSheet?.rows[0] as Record<string, unknown>;
      expect(row.cajaNombre).toBe('Caja Grupo');
      expect(row.responsableNombre).toBe('Juan');
      expect(row.monto).toBe(1500);
    });

    it('enriches Cajas rows with propietarioNombre', async () => {
      await service.generateXlsx();

      const cajasSheet = capturedSpecs.find((s) => s.name === 'Cajas');
      const personalRow = cajasSheet?.rows.find(
        (r) => (r as { id: string }).id === 'c2',
      ) as Record<string, unknown>;
      expect(personalRow.propietarioNombre).toBe('Juan');

      const grupoRow = cajasSheet?.rows.find(
        (r) => (r as { id: string }).id === 'c1',
      ) as Record<string, unknown>;
      expect(
        grupoRow.propietarioNombre === null ||
          grupoRow.propietarioNombre === '',
      ).toBe(true);
    });

    it('flattens campamento participantes into rows of (campamentoId, personaId, names)', async () => {
      await service.generateXlsx();

      const sheet = capturedSpecs.find(
        (s) => s.name === 'CampamentoParticipantes',
      );
      expect(sheet?.rows).toHaveLength(2);

      const first = sheet?.rows[0] as Record<string, unknown>;
      expect(first.campamentoId).toBe('k1');
      expect(first.campamentoNombre).toBe('Campamento Verano');
      expect(first.personaId).toBe('p1');
      expect(first.personaNombre).toBe('Juan');
    });

    it('enriches VentasProductos rows with evento, producto and vendedor names', async () => {
      await service.generateXlsx();

      const sheet = capturedSpecs.find((s) => s.name === 'VentasProductos');
      const row = sheet?.rows[0] as Record<string, unknown>;
      expect(row.eventoNombre).toBe('Venta empanadas');
      expect(row.productoNombre).toBe('Empanada de carne');
      expect(row.vendedorNombre).toBe('Juan');
      expect(row.cantidad).toBe(10);
    });

    it('enriches Inscripciones and Cuotas rows with personaNombre', async () => {
      await service.generateXlsx();

      const inscripcionesSheet = capturedSpecs.find(
        (s) => s.name === 'Inscripciones',
      );
      const inscripcionRow = inscripcionesSheet?.rows[0] as Record<
        string,
        unknown
      >;
      expect(inscripcionRow.personaNombre).toBe('Juan');

      const cuotasSheet = capturedSpecs.find((s) => s.name === 'Cuotas');
      const cuotaRow = cuotasSheet?.rows[0] as Record<string, unknown>;
      expect(cuotaRow.personaNombre).toBe('Juan');
    });

    it('enriches Productos rows with eventoNombre', async () => {
      await service.generateXlsx();

      const productosSheet = capturedSpecs.find((s) => s.name === 'Productos');
      const row = productosSheet?.rows[0] as Record<string, unknown>;
      expect(row.eventoNombre).toBe('Venta empanadas');
    });
  });

  describe('generateFilename', () => {
    it('builds a timestamped .xlsx filename', () => {
      const fixed = new Date(2026, 3, 14, 12, 5, 30);
      expect(service.generateFilename(fixed)).toBe(
        'scout-export-20260414-120530.xlsx',
      );
    });
  });
});
