import { Injectable } from '@nestjs/common';
import { Evento } from '../../entities/evento.entity';
import { ReporteEventoStrategy } from './reporte-evento.strategy';
import { ReporteVentaBuilder } from './reporte-venta.builder';
import { ReporteAggregatorsService } from '../aggregators/reporte-aggregators.service';
import { ReporteVentaCuentasPersonalesDto } from '../dtos/reporte-evento.dto';
import { REPORTE_VARIANTE } from '../reporte.constants';

/**
 * Reporte de venta con destino cuentas_personales: reutiliza los bloques de
 * venta y agrega `gananciaPorPersona` (cuánto recibió cada vendedor en su
 * cuenta personal = Σ margen de sus ventas). El recupero de costo se reporta
 * como figura propia dentro de los KPIs del bloque base (`kpis.recuperoCosto`).
 */
@Injectable()
export class ReporteVentaCuentasPersonalesStrategy implements ReporteEventoStrategy {
  readonly variante = REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES;

  constructor(
    private readonly ventaBuilder: ReporteVentaBuilder,
    private readonly aggregators: ReporteAggregatorsService,
  ) {}

  async build(evento: Evento): Promise<ReporteVentaCuentasPersonalesDto> {
    const [base, gananciaPorPersona] = await Promise.all([
      this.ventaBuilder.build(evento),
      this.aggregators.gananciaPorPersona(evento.id),
    ]);
    return {
      ...base,
      variante: REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES,
      gananciaPorPersona,
    };
  }
}
