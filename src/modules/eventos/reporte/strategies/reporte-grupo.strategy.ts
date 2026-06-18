import { Injectable } from '@nestjs/common';
import { Evento } from '../../entities/evento.entity';
import { EventosService } from '../../eventos.service';
import { ReporteEventoStrategy } from './reporte-evento.strategy';
import { ReporteGrupoDto } from '../dtos/reporte-evento.dto';
import { ReporteIngresoItemDto } from '../dtos/reporte-bloques.dto';
import { REPORTE_SEVERIDAD, REPORTE_VARIANTE } from '../reporte.constants';
import { TipoMovimiento } from '../../../../common/enums';

/**
 * STUB funcional para eventos de GRUPO: no hay productos/ventas; los ingresos
 * son movimientos manuales itemizados. Resultado neto = ingresos − egresos.
 * TODO: enriquecer KPIs/integridad específicos de grupo cuando se diseñe
 * la página de esa variante.
 */
@Injectable()
export class ReporteGrupoStrategy implements ReporteEventoStrategy {
  readonly variante = REPORTE_VARIANTE.GRUPO;

  constructor(private readonly eventosService: EventosService) {}

  async build(evento: Evento): Promise<ReporteGrupoDto> {
    const [kpis, ingresosMovs, egresosMovs] = await Promise.all([
      this.eventosService.getKpisEvento(evento.id),
      this.eventosService.findMovimientosByEvento(evento.id, {
        tipo: TipoMovimiento.INGRESO,
      }),
      this.eventosService.findMovimientosByEvento(evento.id, {
        tipo: TipoMovimiento.EGRESO,
      }),
    ]);

    const ingresos = kpis.gananciaVentas; // suma de ingresos del evento
    const egresos = kpis.totalGastado + kpis.totalPendienteReembolso;
    const netoReal = ingresos - egresos;

    const ingresosItemizados: ReporteIngresoItemDto[] = ingresosMovs
      .map((m) => ({
        descripcion: m.descripcion ?? '',
        responsableNombre: m.responsable?.nombre ?? null,
        medioPago: m.medioPago,
        monto: Number(m.monto),
        fecha:
          m.fecha instanceof Date ? m.fecha.toISOString() : String(m.fecha),
      }))
      .sort((a, b) => b.monto - a.monto);

    return {
      variante: REPORTE_VARIANTE.GRUPO,
      generadoEn: new Date().toISOString(),
      evento: {
        id: evento.id,
        nombre: evento.nombre,
        fecha: String(evento.fecha),
        tipo: evento.tipo,
        destinoGanancia: evento.destinoGanancia,
        estaCerrado: evento.estaCerrado,
      },
      kpis: {
        recaudacionBruta: ingresos,
        ganancia: ingresos,
        egresos,
        netoReal,
        margen: ingresos > 0 ? netoReal / ingresos : 0,
        unidades: 0,
        pendienteReembolso: kpis.totalPendienteReembolso,
        recuperoCosto: 0, // eventos GRUPO no tienen productos/costos que recuperar
      },
      egresos: egresosMovs
        .map((m) => ({
          descripcion: m.descripcion ?? '',
          responsableNombre: m.responsable?.nombre ?? null,
          medioPago: m.medioPago,
          estadoPago: m.estadoPago,
          monto: Number(m.monto),
        }))
        .sort((a, b) => b.monto - a.monto),
      integridad: evento.estaCerrado
        ? []
        : [
            {
              severidad: REPORTE_SEVERIDAD.MEDIA,
              mensaje:
                'El evento está ABIERTO (no cerrado): los datos pueden seguir cambiando',
            },
          ],
      ingresosItemizados,
    };
  }
}
