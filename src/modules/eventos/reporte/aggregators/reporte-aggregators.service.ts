import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VentaProducto } from '../../entities/venta-producto.entity';
import { Entrega } from '../../entities/entrega.entity';
import { PersonaType } from '../../../../common/enums';
import { APP_TIMEZONE } from '../../../../common/constants';
import {
  ReporteEntregaFueraDiaDto,
  ReporteGananciaPersonaDto,
  ReporteHorarioFranjaDto,
  ReporteHorariosEntregaDto,
  ReportePorRamaDto,
  ReportePorTipoPersonaDto,
  ReporteVendedorDto,
} from '../dtos/reporte-bloques.dto';

const TIPO_LABELS: Record<string, string> = {
  [PersonaType.EDUCADOR]: 'Educadores',
  [PersonaType.PROTAGONISTA]: 'Protagonistas',
  [PersonaType.EXTERNA]: 'Externos',
};

const GRUPO_EDUCADORES = 'Educadores';

interface RawTipoRow {
  tipo: string;
  vendedores: string;
  unidades: string;
  recaudado: string;
}

interface RawRamaRow {
  grupo: string | null;
  esEducador: boolean;
  vendedores: string;
  unidades: string;
  recaudado: string;
}

interface RawVendedorRow {
  vendedorId: string;
  nombre: string;
  tipo: string;
  rama: string | null;
  unidades: string;
  recaudado: string;
}

interface RawEntregaRow {
  dia: string;
  hora: string;
  porciones: string;
}

interface RawGananciaPersonaRow {
  personaId: string;
  nombre: string;
  ganancia: string;
}

/**
 * Aggregations that did not exist in EventosService and are needed by the
 * report strategies. QueryBuilder style mirrors EntregasEventoService
 * (raw group-by, soft-delete filters explicit).
 */
@Injectable()
export class ReporteAggregatorsService {
  constructor(
    @InjectRepository(VentaProducto)
    private readonly ventaProductoRepository: Repository<VentaProducto>,
    @InjectRepository(Entrega)
    private readonly entregaRepository: Repository<Entrega>,
  ) {}

  private baseVentasQuery(eventoId: string) {
    return this.ventaProductoRepository
      .createQueryBuilder('v')
      .innerJoin('v.producto', 'pr')
      .innerJoin('v.vendedor', 'pe')
      .where('v.evento_id = :eventoId', { eventoId })
      .andWhere('v."deletedAt" IS NULL');
  }

  async recaudacionPorTipoPersona(
    eventoId: string,
  ): Promise<ReportePorTipoPersonaDto[]> {
    const rows = await this.baseVentasQuery(eventoId)
      .select('pe.tipo', 'tipo')
      .addSelect('COUNT(DISTINCT v.vendedor_id)', 'vendedores')
      .addSelect('SUM(v.cantidad)', 'unidades')
      .addSelect('SUM(v.cantidad * pr."precioVenta")', 'recaudado')
      .groupBy('pe.tipo')
      .getRawMany<RawTipoRow>();

    const total = rows.reduce((s, r) => s + Number(r.recaudado), 0);
    return rows
      .map((r) => ({
        tipo: r.tipo as PersonaType,
        label: TIPO_LABELS[r.tipo] ?? r.tipo,
        vendedores: Number(r.vendedores),
        unidades: Number(r.unidades),
        recaudado: Number(r.recaudado),
        porcentaje: this.ratio(Number(r.recaudado), total),
      }))
      .sort((a, b) => b.recaudado - a.recaudado);
  }

  /**
   * Cada rama cuenta SOLO protagonistas; los educadores (cualquier rama) se
   * agrupan en un único grupo "Educadores".
   */
  async participacionPorRama(eventoId: string): Promise<ReportePorRamaDto[]> {
    // `pe.rama` es un enum; hay que castearlo a text para unificarlo con el
    // literal 'Educadores' en el CASE (si no, Postgres intenta castear
    // 'Educadores' al enum personas_rama_enum y falla).
    const grupoExpr = `CASE WHEN pe.tipo = :educador THEN :educLabel ELSE pe.rama::text END`;
    const rows = await this.baseVentasQuery(eventoId)
      .setParameters({
        educador: PersonaType.EDUCADOR,
        educLabel: GRUPO_EDUCADORES,
      })
      .select(grupoExpr, 'grupo')
      .addSelect(`(pe.tipo = :educador)`, 'esEducador')
      .addSelect('COUNT(DISTINCT v.vendedor_id)', 'vendedores')
      .addSelect('SUM(v.cantidad)', 'unidades')
      .addSelect('SUM(v.cantidad * pr."precioVenta")', 'recaudado')
      .groupBy(grupoExpr)
      .addGroupBy('(pe.tipo = :educador)')
      .getRawMany<RawRamaRow>();

    const total = rows.reduce((s, r) => s + Number(r.recaudado), 0);
    return rows
      .map((r) => ({
        grupo: r.grupo ?? 'Sin rama',
        esEducador: r.esEducador === true,
        vendedores: Number(r.vendedores),
        unidades: Number(r.unidades),
        recaudado: Number(r.recaudado),
        porcentaje: this.ratio(Number(r.recaudado), total),
      }))
      .sort((a, b) => b.recaudado - a.recaudado);
  }

  /**
   * Detalle por vendedor: unidades + recaudación (precioVenta × cantidad),
   * tipo, rama, y entregado/pendiente cruzando contra entregas.
   */
  async vendedoresDetalle(eventoId: string): Promise<ReporteVendedorDto[]> {
    const rows = await this.baseVentasQuery(eventoId)
      .select('v.vendedor_id', 'vendedorId')
      .addSelect('pe.nombre', 'nombre')
      .addSelect('pe.tipo', 'tipo')
      .addSelect('pe.rama', 'rama')
      .addSelect('SUM(v.cantidad)', 'unidades')
      .addSelect('SUM(v.cantidad * pr."precioVenta")', 'recaudado')
      .groupBy('v.vendedor_id')
      .addGroupBy('pe.nombre')
      .addGroupBy('pe.tipo')
      .addGroupBy('pe.rama')
      .getRawMany<RawVendedorRow>();

    const entregadoPorVendedor = await this.entregadoPorVendedor(eventoId);
    const total = rows.reduce((s, r) => s + Number(r.recaudado), 0);

    return rows
      .map((r) => {
        const unidades = Number(r.unidades);
        const entregado = entregadoPorVendedor.get(r.vendedorId) ?? 0;
        return {
          vendedorId: r.vendedorId,
          nombre: r.nombre,
          tipo: r.tipo as PersonaType,
          rama: r.rama,
          unidades,
          recaudado: Number(r.recaudado),
          porcentaje: this.ratio(Number(r.recaudado), total),
          entregado,
          pendiente: unidades - entregado,
        };
      })
      .sort((a, b) => b.recaudado - a.recaudado);
  }

  /**
   * Ganancia (margen) que recibió cada vendedor en su cuenta personal:
   * Σ (precioVenta − precioCosto) × cantidad por vendedor. Para eventos con
   * destino cuentas_personales coincide con lo acreditado en su caja personal.
   */
  async gananciaPorPersona(
    eventoId: string,
  ): Promise<ReporteGananciaPersonaDto[]> {
    const rows = await this.baseVentasQuery(eventoId)
      .select('v.vendedor_id', 'personaId')
      .addSelect('pe.nombre', 'nombre')
      .addSelect(
        'SUM(v.cantidad * (pr."precioVenta" - pr."precioCosto"))',
        'ganancia',
      )
      .groupBy('v.vendedor_id')
      .addGroupBy('pe.nombre')
      .getRawMany<RawGananciaPersonaRow>();

    return rows
      .map((r) => ({
        personaId: r.personaId,
        nombre: r.nombre,
        ganancia: Number(r.ganancia),
      }))
      .sort((a, b) => b.ganancia - a.ganancia);
  }

  /** Cantidad de ventas activas del evento sin movimiento de ingreso asociado. */
  async ventasSinMovimiento(eventoId: string): Promise<number> {
    return this.ventaProductoRepository
      .createQueryBuilder('v')
      .where('v.evento_id = :eventoId', { eventoId })
      .andWhere('v."deletedAt" IS NULL')
      .andWhere('v.movimiento_id IS NULL')
      .getCount();
  }

  private async entregadoPorVendedor(
    eventoId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.entregaRepository
      .createQueryBuilder('e')
      .innerJoin('e.lineas', 'el')
      .select('e.vendedor_id', 'vendedorId')
      .addSelect('SUM(el.cantidad)', 'entregado')
      .where('e.evento_id = :eventoId', { eventoId })
      .andWhere('e."deletedAt" IS NULL')
      .andWhere('el."deletedAt" IS NULL')
      .groupBy('e.vendedor_id')
      .getRawMany<{ vendedorId: string; entregado: string }>();
    return new Map(rows.map((r) => [r.vendedorId, Number(r.entregado)]));
  }

  /**
   * Histograma de entregas por franja de 30 min en hora AR. `entrega.fecha`
   * es null en la práctica, así que se usa `createdAt`. El día con más
   * porciones es el "principal"; lo registrado otros días va a `fueraDeDia`.
   */
  async histogramaEntregas(
    eventoId: string,
  ): Promise<ReporteHorariosEntregaDto> {
    const tzExpr = `(e."createdAt" AT TIME ZONE :tz)`;
    const rows = await this.entregaRepository
      .createQueryBuilder('e')
      .leftJoin('e.lineas', 'el', 'el."deletedAt" IS NULL')
      .select(`to_char(${tzExpr}, 'YYYY-MM-DD')`, 'dia')
      .addSelect(`to_char(${tzExpr}, 'HH24:MI')`, 'hora')
      .addSelect('COALESCE(SUM(el.cantidad), 0)', 'porciones')
      .where('e.evento_id = :eventoId', { eventoId })
      .andWhere('e."deletedAt" IS NULL')
      .groupBy('e.id')
      .addSelect('e."createdAt"')
      .setParameter('tz', APP_TIMEZONE)
      .getRawMany<RawEntregaRow>();

    return this.bucketEntregas(rows);
  }

  private bucketEntregas(rows: RawEntregaRow[]): ReporteHorariosEntregaDto {
    // entregas por día (para elegir el día principal por mayor cantidad)
    const porDia = new Map<string, { entregas: number; porciones: number }>();
    for (const r of rows) {
      const acc = porDia.get(r.dia) ?? { entregas: 0, porciones: 0 };
      acc.entregas += 1;
      acc.porciones += Number(r.porciones);
      porDia.set(r.dia, acc);
    }

    const diaPrincipal = this.pickDiaPrincipal(porDia);
    const franjasMap = new Map<string, ReporteHorarioFranjaDto>();
    let totalEntregas = 0;
    let totalPorciones = 0;

    for (const r of rows) {
      if (r.dia !== diaPrincipal) continue;
      const desde = this.franjaInicio(r.hora);
      const franja = franjasMap.get(desde) ?? {
        desde,
        hasta: this.franjaFin(desde),
        entregas: 0,
        porciones: 0,
      };
      franja.entregas += 1;
      franja.porciones += Number(r.porciones);
      franjasMap.set(desde, franja);
      totalEntregas += 1;
      totalPorciones += Number(r.porciones);
    }

    const fueraDeDia: ReporteEntregaFueraDiaDto[] = Array.from(porDia.entries())
      .filter(([dia]) => dia !== diaPrincipal)
      .map(([dia, v]) => ({
        dia,
        entregas: v.entregas,
        porciones: v.porciones,
      }))
      .sort((a, b) => a.dia.localeCompare(b.dia));

    return {
      diaPrincipal,
      franjas: Array.from(franjasMap.values()).sort((a, b) =>
        a.desde.localeCompare(b.desde),
      ),
      totalEntregas,
      totalPorciones,
      fueraDeDia,
    };
  }

  private pickDiaPrincipal(
    porDia: Map<string, { entregas: number; porciones: number }>,
  ): string {
    let best = '';
    let bestPorciones = -1;
    for (const [dia, v] of porDia.entries()) {
      if (v.porciones > bestPorciones) {
        best = dia;
        bestPorciones = v.porciones;
      }
    }
    return best;
  }

  private franjaInicio(hora: string): string {
    const [h, m] = hora.split(':');
    return `${h}:${Number(m) < 30 ? '00' : '30'}`;
  }

  private franjaFin(desde: string): string {
    const [h, m] = desde.split(':').map(Number);
    return m === 0
      ? `${String(h).padStart(2, '0')}:30`
      : `${String(h + 1).padStart(2, '0')}:00`;
  }

  private ratio(part: number, total: number): number {
    return total > 0 ? part / total : 0;
  }
}
