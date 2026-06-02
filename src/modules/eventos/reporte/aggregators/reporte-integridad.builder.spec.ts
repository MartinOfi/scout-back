import {
  buildIntegridadVenta,
  IntegridadVentaParams,
} from './reporte-integridad.builder';
import { REPORTE_SEVERIDAD } from '../reporte.constants';

function baseParams(
  overrides: Partial<IntegridadVentaParams> = {},
): IntegridadVentaParams {
  return {
    estaCerrado: false,
    ganancia: 1426820,
    gananciaTeorica: 1426820,
    totalPendiente: 0,
    ventasSinMovimiento: 0,
    egresosDetalle: [],
    entregasFueraDeDia: [],
    ...overrides,
  };
}

describe('buildIntegridadVenta', () => {
  it('marca OK cuando todas las ventas tienen movimiento', () => {
    const flags = buildIntegridadVenta(baseParams());
    expect(flags.some((f) => f.mensaje.includes('Todas las ventas'))).toBe(
      true,
    );
  });

  it('marca OK cuando ingresos == ganancia teórica', () => {
    const flags = buildIntegridadVenta(baseParams());
    const okGanancia = flags.find((f) =>
      f.mensaje.includes('ganancia teórica'),
    );
    expect(okGanancia?.severidad).toBe(REPORTE_SEVERIDAD.OK);
  });

  it('ya NO incluye la advertencia de doble conteo (balance corregido)', () => {
    const flags = buildIntegridadVenta(baseParams());
    expect(flags.some((f) => f.mensaje.includes('doble conteo'))).toBe(false);
  });

  it('alerta cuando hay ventas sin movimiento', () => {
    const flags = buildIntegridadVenta(baseParams({ ventasSinMovimiento: 3 }));
    const alta = flags.find((f) =>
      f.mensaje.includes('3 ventas sin movimiento'),
    );
    expect(alta?.severidad).toBe(REPORTE_SEVERIDAD.ALTA);
  });

  it('reporta unidades pendientes de retiro', () => {
    const flags = buildIntegridadVenta(baseParams({ totalPendiente: 15 }));
    expect(flags.some((f) => f.mensaje.includes('15 unidades'))).toBe(true);
  });

  it('reporta entregas registradas fuera del día', () => {
    const flags = buildIntegridadVenta(
      baseParams({
        entregasFueraDeDia: [
          { dia: '2026-05-27', entregas: 1, porciones: 3 },
          { dia: '2026-06-01', entregas: 1, porciones: 3 },
        ],
      }),
    );
    const flag = flags.find((f) => f.mensaje.includes('fuera del día'));
    expect(flag?.mensaje).toContain('2026-05-27');
    expect(flag?.mensaje).toContain('2026-06-01');
  });

  it('detecta egresos sin comprobante por descripción', () => {
    const flags = buildIntegridadVenta(
      baseParams({
        egresosDetalle: [
          {
            descripcion: 'calabaza- no hay ticket',
            responsableNombre: 'X',
            medioPago: 'efectivo',
            estadoPago: 'pagado',
            monto: 13600,
          },
        ],
      }),
    );
    expect(flags.some((f) => f.mensaje.includes('sin comprobante'))).toBe(true);
  });

  it('no agrega la alerta de evento abierto cuando está cerrado', () => {
    const flags = buildIntegridadVenta(baseParams({ estaCerrado: true }));
    expect(flags.some((f) => f.mensaje.includes('ABIERTO'))).toBe(false);
  });
});
