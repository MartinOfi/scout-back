import { ReporteVentaMixtaStrategy } from './reporte-venta-mixta.strategy';
import { ReporteVentaBuilder } from './reporte-venta.builder';
import { ReporteAggregatorsService } from '../aggregators/reporte-aggregators.service';
import { REPORTE_VARIANTE } from '../reporte.constants';
import { Evento } from '../../entities/evento.entity';
import { DestinoGanancia } from '../../../../common/enums';

describe('ReporteVentaMixtaStrategy', () => {
  const basePayload = {
    generadoEn: '2026-06-01T00:00:00.000Z',
    evento: { id: 'ev1' },
    kpis: { recuperoCosto: 4000, ganancia: 9000, egresos: 1000 },
    egresos: [],
    integridad: [],
    productos: [],
    porTipoPersona: [],
    porRama: [],
    vendedores: [],
    stock: {},
    horariosEntrega: {},
  };

  const ganancias = [{ personaId: 'p1', nombre: 'Juan', ganancia: 3000 }];

  const ladoGrupo = {
    recaudado: 20000,
    ganancia: 5000,
    unidades: 100,
    pendienteCobro: 0,
  };

  const ladoPersonal = {
    recaudado: 12000,
    ganancia: 4000,
    unidades: 60,
    pendienteCobro: 500,
  };

  function build() {
    const ventaBuilder = {
      build: jest.fn().mockResolvedValue(basePayload),
    } as unknown as ReporteVentaBuilder;
    const aggregators = {
      gananciaPorPersona: jest.fn().mockResolvedValue(ganancias),
      totalesPorDestino: jest
        .fn()
        .mockImplementation((_eventoId: string, destino: DestinoGanancia) =>
          Promise.resolve(
            destino === DestinoGanancia.CAJA_GRUPO ? ladoGrupo : ladoPersonal,
          ),
        ),
    } as unknown as ReporteAggregatorsService;
    const strategy = new ReporteVentaMixtaStrategy(ventaBuilder, aggregators);
    return { strategy, ventaBuilder, aggregators };
  }

  it('arma porDestino consultando totalesPorDestino para cada lado', async () => {
    const { strategy, aggregators } = build();
    const evento = { id: 'ev1' } as Evento;

    const result = await strategy.build(evento);

    expect(aggregators.totalesPorDestino).toHaveBeenCalledWith(
      'ev1',
      DestinoGanancia.CAJA_GRUPO,
    );
    expect(aggregators.totalesPorDestino).toHaveBeenCalledWith(
      'ev1',
      DestinoGanancia.CUENTAS_PERSONALES,
    );
    expect(result.variante).toBe(REPORTE_VARIANTE.VENTA_MIXTA);
    expect(result.gananciaPorPersona).toEqual(ganancias);
  });

  it('netoGrupo = ganancia del lado grupo + recuperoCosto − egresos del evento', async () => {
    const { strategy } = build();

    const result = await strategy.build({ id: 'ev1' } as Evento);

    // ganancia (5000) + recuperoCosto (4000) - egresos (1000) = 8000
    expect(result.porDestino.cajaGrupo.neto).toBe(8000);
    // El resto del bloque no se toca.
    expect(result.porDestino.cajaGrupo.recaudado).toBe(20000);
    expect(result.porDestino.cajaGrupo.pendienteCobro).toBe(0);
  });

  it('netoPersonal = ganancia del lado personal, sin descontar egresos del grupo', async () => {
    const { strategy } = build();

    const result = await strategy.build({ id: 'ev1' } as Evento);

    // Los egresos del evento son 100% del grupo — no deben afectar este lado.
    expect(result.porDestino.cuentasPersonales.neto).toBe(
      ladoPersonal.ganancia,
    );
    expect(result.porDestino.cuentasPersonales.pendienteCobro).toBe(500);
  });
});
