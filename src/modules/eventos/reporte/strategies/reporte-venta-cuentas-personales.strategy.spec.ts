import { ReporteVentaCuentasPersonalesStrategy } from './reporte-venta-cuentas-personales.strategy';
import { ReporteVentaBuilder } from './reporte-venta.builder';
import { ReporteAggregatorsService } from '../aggregators/reporte-aggregators.service';
import { REPORTE_VARIANTE } from '../reporte.constants';
import { Evento } from '../../entities/evento.entity';

describe('ReporteVentaCuentasPersonalesStrategy', () => {
  const basePayload = {
    generadoEn: '2026-06-01T00:00:00.000Z',
    evento: { id: 'ev1' },
    kpis: { recuperoCosto: 5000, ganancia: 5000 },
    egresos: [],
    integridad: [],
    productos: [],
    porTipoPersona: [],
    porRama: [],
    vendedores: [],
    stock: {},
    horariosEntrega: {},
  };

  const ganancias = [
    { personaId: 'p1', nombre: 'Juan', ganancia: 3000 },
    { personaId: 'p2', nombre: 'Maria', ganancia: 2000 },
  ];

  function build() {
    const ventaBuilder = {
      build: jest.fn().mockResolvedValue(basePayload),
    } as unknown as ReporteVentaBuilder;
    const aggregators = {
      gananciaPorPersona: jest.fn().mockResolvedValue(ganancias),
    } as unknown as ReporteAggregatorsService;
    const strategy = new ReporteVentaCuentasPersonalesStrategy(
      ventaBuilder,
      aggregators,
    );
    return { strategy, ventaBuilder, aggregators };
  }

  it('puebla gananciaPorPersona desde el aggregator y conserva los bloques base', async () => {
    const { strategy, aggregators } = build();
    const evento = { id: 'ev1' } as Evento;

    const result = await strategy.build(evento);

    expect(aggregators.gananciaPorPersona).toHaveBeenCalledWith('ev1');
    expect(result.variante).toBe(REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES);
    expect(result.gananciaPorPersona).toEqual(ganancias);
    // El recupero (figura propia) viaja en los KPIs del bloque base.
    expect(result.kpis.recuperoCosto).toBe(5000);
  });
});
