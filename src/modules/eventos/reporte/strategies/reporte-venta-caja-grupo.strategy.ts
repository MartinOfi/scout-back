import { Injectable } from '@nestjs/common';
import { Evento } from '../../entities/evento.entity';
import { ReporteEventoStrategy } from './reporte-evento.strategy';
import { ReporteVentaBuilder } from './reporte-venta.builder';
import { ReporteVentaCajaGrupoDto } from '../dtos/reporte-evento.dto';
import { REPORTE_VARIANTE } from '../reporte.constants';

@Injectable()
export class ReporteVentaCajaGrupoStrategy implements ReporteEventoStrategy {
  readonly variante = REPORTE_VARIANTE.VENTA_CAJA_GRUPO;

  constructor(private readonly ventaBuilder: ReporteVentaBuilder) {}

  async build(evento: Evento): Promise<ReporteVentaCajaGrupoDto> {
    const base = await this.ventaBuilder.build(evento);
    return { ...base, variante: REPORTE_VARIANTE.VENTA_CAJA_GRUPO };
  }
}
