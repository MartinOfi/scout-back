import { Injectable } from '@nestjs/common';
import { Evento } from '../../entities/evento.entity';
import { ReporteEventoStrategy } from './reporte-evento.strategy';
import { ReporteVentaBuilder } from './reporte-venta.builder';
import { ReporteVentaCuentasPersonalesDto } from '../dtos/reporte-evento.dto';
import { REPORTE_VARIANTE } from '../reporte.constants';

/**
 * STUB. Reutiliza los bloques de venta. Falta implementar `gananciaPorPersona`
 * (payout de ganancia a cada cuenta personal) — para una venta con destino
 * cuentas_personales, la ganancia de cada vendedor va a su caja personal.
 * TODO: agregar aggregator de ganancia por persona y completar el bloque.
 */
@Injectable()
export class ReporteVentaCuentasPersonalesStrategy
  implements ReporteEventoStrategy
{
  readonly variante = REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES;

  constructor(private readonly ventaBuilder: ReporteVentaBuilder) {}

  async build(evento: Evento): Promise<ReporteVentaCuentasPersonalesDto> {
    const base = await this.ventaBuilder.build(evento);
    return {
      ...base,
      variante: REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES,
      // TODO: derivar de las ventas por vendedor con destino cuenta personal.
      gananciaPorPersona: [],
    };
  }
}
