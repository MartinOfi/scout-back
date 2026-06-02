import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Evento } from '../entities/evento.entity';
import { EventosService } from '../eventos.service';
import { TipoEvento, DestinoGanancia } from '../../../common/enums';
import { ReporteEventoDto } from './dtos/reporte-evento.dto';
import {
  ReporteEventoStrategy,
  REPORTE_EVENTO_STRATEGIES,
} from './strategies/reporte-evento.strategy';
import {
  REPORTE_ERROR_MESSAGES,
  REPORTE_VARIANTE,
  ReporteVariante,
} from './reporte.constants';

/**
 * Orquestador del reporte de evento. Resuelve la variante (tipo × destino) y
 * delega en la estrategia registrada. Agregar una variante nueva = registrar
 * una estrategia más en el módulo; este servicio no cambia (Open/Closed).
 */
@Injectable()
export class ReporteEventoService {
  private readonly registry: Map<ReporteVariante, ReporteEventoStrategy>;

  constructor(
    private readonly eventosService: EventosService,
    @Inject(REPORTE_EVENTO_STRATEGIES)
    strategies: ReporteEventoStrategy[],
  ) {
    this.registry = new Map(strategies.map((s) => [s.variante, s]));
  }

  async getReporte(eventoId: string): Promise<ReporteEventoDto> {
    const evento = await this.eventosService.findOne(eventoId);
    const variante = this.resolveVariante(evento);
    const strategy = this.registry.get(variante);
    if (!strategy) {
      throw new BadRequestException(
        REPORTE_ERROR_MESSAGES.VARIANTE_SIN_STRATEGY(variante),
      );
    }
    return strategy.build(evento);
  }

  private resolveVariante(evento: Evento): ReporteVariante {
    if (evento.tipo === TipoEvento.GRUPO) {
      return REPORTE_VARIANTE.GRUPO;
    }
    // tipo === VENTA
    if (evento.destinoGanancia === DestinoGanancia.CAJA_GRUPO) {
      return REPORTE_VARIANTE.VENTA_CAJA_GRUPO;
    }
    if (evento.destinoGanancia === DestinoGanancia.CUENTAS_PERSONALES) {
      return REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES;
    }
    // Evento de venta sin destinoGanancia: estado inválido (ver AUDIT).
    throw new BadRequestException(
      REPORTE_ERROR_MESSAGES.VARIANTE_NO_RESOLVIBLE(evento.id),
    );
  }
}
