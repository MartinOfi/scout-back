import { ReporteVentaBuilder } from './reporte-venta.builder';
import { EventosService } from '../../eventos.service';
import { EntregasEventoService } from '../../services/entregas-evento.service';
import { ReporteAggregatorsService } from '../aggregators/reporte-aggregators.service';
import { TipoEvento, DestinoGanancia, PersonaType } from '../../../../common/enums';
import { Evento } from '../../entities/evento.entity';

const EVENTO = {
  id: 'evt-1',
  nombre: 'VENTA LOCRO 25 MAYO',
  fecha: '2026-05-25',
  tipo: TipoEvento.VENTA,
  destinoGanancia: DestinoGanancia.CAJA_GRUPO,
  estaCerrado: false,
} as unknown as Evento;

describe('ReporteVentaBuilder', () => {
  let eventosService: {
    getKpisEvento: jest.Mock;
    getResumenVentas: jest.Mock;
    findMovimientosByEvento: jest.Mock;
  };
  let entregasService: { getStockDisponible: jest.Mock };
  let aggregators: Record<string, jest.Mock>;
  let builder: ReporteVentaBuilder;

  beforeEach(() => {
    eventosService = {
      getKpisEvento: jest.fn().mockResolvedValue({
        totalRecaudado: 1796000,
        gananciaVentas: 1426820,
        totalGastado: 514867.29,
        totalPendienteReembolso: 0,
        balance: 911952.71,
      }),
      getResumenVentas: jest.fn().mockResolvedValue({
        productos: [
          {
            nombre: 'LOCRO',
            precioCosto: 2500,
            precioVenta: 12000,
            cantidadVendida: 143,
            ganancia: 1358500,
          },
          {
            nombre: 'LOCRO VEGGIE',
            precioCosto: 1460,
            precioVenta: 10000,
            cantidadVendida: 8,
            ganancia: 68320,
          },
        ],
        ventasPorVendedor: [],
        gananciaTotal: 1426820,
      }),
      findMovimientosByEvento: jest.fn().mockResolvedValue([
        {
          descripcion: 'carniceria',
          responsable: { nombre: 'González, Ariel' },
          medioPago: 'efectivo',
          estadoPago: 'pagado',
          monto: 109241.65,
        },
      ]),
    };
    entregasService = {
      getStockDisponible: jest.fn().mockResolvedValue([
        {
          productoNombre: 'LOCRO',
          cantidadVendida: 143,
          cantidadEntregada: 129,
          cantidadDisponible: 14,
        },
        {
          productoNombre: 'LOCRO VEGGIE',
          cantidadVendida: 8,
          cantidadEntregada: 7,
          cantidadDisponible: 1,
        },
      ]),
    };
    aggregators = {
      recaudacionPorTipoPersona: jest.fn().mockResolvedValue([
        { tipo: PersonaType.EDUCADOR, label: 'Educadores', vendedores: 10, unidades: 91, recaudado: 1084000, porcentaje: 0.6 },
      ]),
      participacionPorRama: jest.fn().mockResolvedValue([]),
      vendedoresDetalle: jest.fn().mockResolvedValue([]),
      histogramaEntregas: jest.fn().mockResolvedValue({
        diaPrincipal: '2026-05-25',
        franjas: [],
        totalEntregas: 47,
        totalPorciones: 130,
        fueraDeDia: [],
      }),
      ventasSinMovimiento: jest.fn().mockResolvedValue(0),
    };
    builder = new ReporteVentaBuilder(
      eventosService as unknown as EventosService,
      entregasService as unknown as EntregasEventoService,
      aggregators as unknown as ReporteAggregatorsService,
    );
  });

  it('calcula los KPIs con netoReal = recaudación − egresos', async () => {
    const r = await builder.build(EVENTO);
    expect(r.kpis.recaudacionBruta).toBe(1796000);
    expect(r.kpis.ganancia).toBe(1426820);
    expect(r.kpis.egresos).toBeCloseTo(514867.29, 2);
    expect(r.kpis.netoReal).toBeCloseTo(1281132.71, 2);
    expect(r.kpis.margen).toBeCloseTo(0.7133, 3);
    expect(r.kpis.unidades).toBe(151);
  });

  it('arma productos con recaudado = precioVenta × unidades, ordenados desc', async () => {
    const r = await builder.build(EVENTO);
    expect(r.productos[0].nombre).toBe('LOCRO');
    expect(r.productos[0].recaudado).toBe(1716000);
    expect(r.productos[0].margenUnitario).toBe(9500);
    expect(r.productos[0].porcentaje).toBeCloseTo(1716000 / 1796000, 4);
  });

  it('agrega stock por producto con totales', async () => {
    const r = await builder.build(EVENTO);
    expect(r.stock.totalVendido).toBe(151);
    expect(r.stock.totalEntregado).toBe(136);
    expect(r.stock.totalPendiente).toBe(15);
  });

  it('incluye los bloques de venta y la integridad', async () => {
    const r = await builder.build(EVENTO);
    expect(r.porTipoPersona).toHaveLength(1);
    expect(r.horariosEntrega.totalPorciones).toBe(130);
    expect(r.integridad.length).toBeGreaterThan(0);
    expect(r.egresos[0].descripcion).toBe('carniceria');
  });
});
