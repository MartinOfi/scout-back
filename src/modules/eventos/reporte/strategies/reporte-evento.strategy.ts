import { Evento } from '../../entities/evento.entity';
import { ReporteEventoDto } from '../dtos/reporte-evento.dto';
import { ReporteVariante } from '../reporte.constants';

/**
 * A report strategy knows how to build ONE variant of the event report.
 * The orchestrator (`ReporteEventoService`) resolves the variant of an evento
 * and delegates to the matching strategy. Adding a new variant = new strategy
 * + a registry entry; existing strategies stay untouched (Open/Closed).
 */
export interface ReporteEventoStrategy {
  readonly variante: ReporteVariante;
  build(evento: Evento): Promise<ReporteEventoDto>;
}

/** DI token for the multi-provider array of strategies. */
export const REPORTE_EVENTO_STRATEGIES = Symbol('REPORTE_EVENTO_STRATEGIES');
