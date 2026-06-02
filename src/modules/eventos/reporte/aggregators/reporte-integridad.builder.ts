import { REPORTE_SEVERIDAD, ReporteSeveridad } from '../reporte.constants';
import {
  ReporteEgresoDto,
  ReporteEntregaFueraDiaDto,
  ReporteIntegridadFlagDto,
} from '../dtos/reporte-bloques.dto';

const SIN_COMPROBANTE_RE = /no hay ticket|sin ticket|sin comprobante/i;

const ars = (n: number): string => '$' + Math.round(n).toLocaleString('es-AR');

export interface IntegridadVentaParams {
  estaCerrado: boolean;
  ganancia: number; // ingresos registrados
  gananciaTeorica: number; // Σ (precioVenta − precioCosto) × cantidad
  totalPendiente: number;
  ventasSinMovimiento: number;
  egresosDetalle: ReporteEgresoDto[];
  entregasFueraDeDia: ReporteEntregaFueraDiaDto[];
}

function flag(
  severidad: ReporteSeveridad,
  mensaje: string,
): ReporteIntegridadFlagDto {
  return { severidad, mensaje };
}

/**
 * Construye los flags de integridad de un evento de VENTA: ventas sin
 * movimiento, ingresos vs ganancia teórica, pendientes de retiro, entregas
 * registradas fuera del día, egresos sin comprobante y evento abierto.
 */
export function buildIntegridadVenta(
  p: IntegridadVentaParams,
): ReporteIntegridadFlagDto[] {
  const flags: ReporteIntegridadFlagDto[] = [];

  flags.push(
    p.ventasSinMovimiento > 0
      ? flag(
          REPORTE_SEVERIDAD.ALTA,
          `${p.ventasSinMovimiento} ventas sin movimiento de ingreso asociado`,
        )
      : flag(
          REPORTE_SEVERIDAD.OK,
          'Todas las ventas tienen su movimiento de ingreso asociado',
        ),
  );

  flags.push(
    Math.abs(p.ganancia - p.gananciaTeorica) < 1
      ? flag(
          REPORTE_SEVERIDAD.OK,
          `Los ingresos registrados (${ars(p.ganancia)}) coinciden con la ganancia teórica de las ventas`,
        )
      : flag(
          REPORTE_SEVERIDAD.ALTA,
          `Los ingresos (${ars(p.ganancia)}) no coinciden con la ganancia teórica (${ars(p.gananciaTeorica)})`,
        ),
  );

  if (p.totalPendiente > 0) {
    flags.push(
      flag(
        REPORTE_SEVERIDAD.MEDIA,
        `${p.totalPendiente} unidades vendidas aún sin retirar`,
      ),
    );
  }

  const fueraDeDiaTotal = p.entregasFueraDeDia.reduce(
    (s, d) => s + d.entregas,
    0,
  );
  if (fueraDeDiaTotal > 0) {
    const dias = p.entregasFueraDeDia.map((d) => d.dia).join(', ');
    flags.push(
      flag(
        REPORTE_SEVERIDAD.MEDIA,
        `${fueraDeDiaTotal} entrega(s) se registraron fuera del día del evento (${dias}) como corrección`,
      ),
    );
  }

  const sinComprobante = p.egresosDetalle.filter((e) =>
    SIN_COMPROBANTE_RE.test(e.descripcion),
  );
  if (sinComprobante.length > 0) {
    const monto = sinComprobante.reduce((s, e) => s + e.monto, 0);
    flags.push(
      flag(
        REPORTE_SEVERIDAD.MEDIA,
        `${sinComprobante.length} egreso(s) sin comprobante (total ${ars(monto)})`,
      ),
    );
  }

  if (!p.estaCerrado) {
    flags.push(
      flag(
        REPORTE_SEVERIDAD.MEDIA,
        'El evento está ABIERTO (no cerrado): los datos pueden seguir cambiando',
      ),
    );
  }

  return flags;
}
