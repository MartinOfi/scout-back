import { Injectable } from '@nestjs/common';
import { Evento } from '../../entities/evento.entity';
import { ReporteEventoStrategy } from './reporte-evento.strategy';
import { ReporteVentaBuilder } from './reporte-venta.builder';
import { ReporteAggregatorsService } from '../aggregators/reporte-aggregators.service';
import { ReporteVentaMixtaDto } from '../dtos/reporte-evento.dto';
import { ReporteDestinoLadoDto } from '../dtos/reporte-bloques.dto';
import { REPORTE_VARIANTE } from '../reporte.constants';
import { DestinoGanancia } from '../../../../common/enums';

/**
 * Reporte de un evento de venta con modalidad MIXTA: parte de las ventas fueron
 * a la caja del grupo y parte a cuentas personales, con gastos únicos para todo
 * el evento.
 *
 * Reutiliza tal cual los bloques comunes de venta y agrega `porDestino`, que
 * abre los KPIs de cada lado. No duplica ninguna query: corre las mismas
 * agregaciones filtrando por destino en el choke point del agregador.
 *
 * Imputación de gastos (decisión de negocio): los egresos son 100% del grupo.
 * La caja grupo ya recupera el costo de la mercadería de las ventas personales
 * vía el movimiento de recupero, así que el resto de los gastos (transporte,
 * permisos) son costo del grupo y NO reducen lo que reciben los chicos.
 */
@Injectable()
export class ReporteVentaMixtaStrategy implements ReporteEventoStrategy {
  readonly variante = REPORTE_VARIANTE.VENTA_MIXTA;

  constructor(
    private readonly ventaBuilder: ReporteVentaBuilder,
    private readonly aggregators: ReporteAggregatorsService,
  ) {}

  async build(evento: Evento): Promise<ReporteVentaMixtaDto> {
    const [base, gananciaPorPersona, ladoGrupo, ladoPersonal] =
      await Promise.all([
        this.ventaBuilder.build(evento),
        this.aggregators.gananciaPorPersona(evento.id),
        this.aggregators.totalesPorDestino(
          evento.id,
          DestinoGanancia.CAJA_GRUPO,
        ),
        this.aggregators.totalesPorDestino(
          evento.id,
          DestinoGanancia.CUENTAS_PERSONALES,
        ),
      ]);

    return {
      ...base,
      variante: REPORTE_VARIANTE.VENTA_MIXTA,
      gananciaPorPersona,
      porDestino: {
        cajaGrupo: this.withNetoGrupo(
          ladoGrupo,
          base.kpis.egresos,
          base.kpis.recuperoCosto,
        ),
        cuentasPersonales: this.withNetoPersonal(ladoPersonal),
      },
    };
  }

  /**
   * netoGrupo = ganancia del grupo + recupero de costo − egresos del evento.
   * El recupero entra acá porque es plata que vuelve a la caja grupo por la
   * mercadería que financió para las ventas personales.
   */
  private withNetoGrupo(
    lado: ReporteDestinoLadoDto,
    egresos: number,
    recuperoCosto: number,
  ): ReporteDestinoLadoDto {
    return { ...lado, neto: lado.ganancia + recuperoCosto - egresos };
  }

  /** netoPersonal = Σ márgenes, sin descuento de gastos (ver doc de la clase). */
  private withNetoPersonal(lado: ReporteDestinoLadoDto): ReporteDestinoLadoDto {
    return { ...lado, neto: lado.ganancia };
  }
}
