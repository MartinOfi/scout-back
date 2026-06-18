import { Injectable } from '@nestjs/common';
import { Evento } from '../../entities/evento.entity';
import { EventosService } from '../../eventos.service';
import { EntregasEventoService } from '../../services/entregas-evento.service';
import { ReporteAggregatorsService } from '../aggregators/reporte-aggregators.service';
import { buildIntegridadVenta } from '../aggregators/reporte-integridad.builder';
import { ReporteVentaBaseDto } from '../dtos/reporte-evento.dto';
import {
  ReporteEgresoDto,
  ReporteProductoDto,
  ReporteStockDto,
  ReporteStockProductoDto,
} from '../dtos/reporte-bloques.dto';
import { TipoMovimiento } from '../../../../common/enums';
import type { StockEntregaResponseDto } from '../../dtos';

/** Payload común de venta, sin el discriminador `variante`. */
export type ReporteVentaBasePayload = ReporteVentaBaseDto;

/**
 * Arma los bloques comunes a todo evento de VENTA (caja_grupo y
 * cuentas_personales). Reutiliza la agregación existente de EventosService /
 * EntregasEventoService y las agregaciones nuevas de ReporteAggregatorsService.
 */
@Injectable()
export class ReporteVentaBuilder {
  constructor(
    private readonly eventosService: EventosService,
    private readonly entregasService: EntregasEventoService,
    private readonly aggregators: ReporteAggregatorsService,
  ) {}

  async build(evento: Evento): Promise<ReporteVentaBasePayload> {
    const [kpisRaw, resumen, egresosMovs, stockRows] = await Promise.all([
      this.eventosService.getKpisEvento(evento.id),
      this.eventosService.getResumenVentas(evento.id),
      this.eventosService.findMovimientosByEvento(evento.id, {
        tipo: TipoMovimiento.EGRESO,
      }),
      this.entregasService.getStockDisponible(evento.id),
    ]);

    const [porTipoPersona, porRama, vendedores, horariosEntrega, ventasSinMov] =
      await Promise.all([
        this.aggregators.recaudacionPorTipoPersona(evento.id),
        this.aggregators.participacionPorRama(evento.id),
        this.aggregators.vendedoresDetalle(evento.id),
        this.aggregators.histogramaEntregas(evento.id),
        this.aggregators.ventasSinMovimiento(evento.id),
      ]);

    const recaudacionBruta = kpisRaw.totalRecaudado;
    const egresos = kpisRaw.totalGastado + kpisRaw.totalPendienteReembolso;
    const netoReal = recaudacionBruta - egresos;
    const unidades = resumen.productos.reduce(
      (s, p) => s + p.cantidadVendida,
      0,
    );

    const productos = this.buildProductos(resumen.productos, recaudacionBruta);
    const egresosDetalle = this.buildEgresos(egresosMovs);
    const stock = this.buildStock(stockRows);

    const integridad = buildIntegridadVenta({
      estaCerrado: evento.estaCerrado,
      ganancia: kpisRaw.gananciaVentas,
      gananciaTeorica: resumen.gananciaTotal,
      totalPendiente: stock.totalPendiente,
      ventasSinMovimiento: ventasSinMov,
      egresosDetalle,
      entregasFueraDeDia: horariosEntrega.fueraDeDia,
    });

    return {
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
        recaudacionBruta,
        ganancia: kpisRaw.gananciaVentas,
        egresos,
        netoReal,
        margen: recaudacionBruta > 0 ? netoReal / recaudacionBruta : 0,
        unidades,
        pendienteReembolso: kpisRaw.totalPendienteReembolso,
        recuperoCosto: kpisRaw.totalRecuperado,
      },
      egresos: egresosDetalle,
      integridad,
      productos,
      porTipoPersona,
      porRama,
      vendedores,
      stock,
      horariosEntrega,
    };
  }

  private buildProductos(
    productos: Array<{
      nombre: string;
      precioCosto: number;
      precioVenta: number;
      cantidadVendida: number;
    }>,
    recaudacionBruta: number,
  ): ReporteProductoDto[] {
    return productos
      .map((p) => {
        const recaudado = p.precioVenta * p.cantidadVendida;
        return {
          nombre: p.nombre,
          precioCosto: p.precioCosto,
          precioVenta: p.precioVenta,
          margenUnitario: p.precioVenta - p.precioCosto,
          unidades: p.cantidadVendida,
          recaudado,
          porcentaje: recaudacionBruta > 0 ? recaudado / recaudacionBruta : 0,
        };
      })
      .sort((a, b) => b.recaudado - a.recaudado);
  }

  private buildEgresos(
    movimientos: ReadonlyArray<{
      descripcion: string | null;
      responsable?: { nombre: string } | null;
      medioPago: string;
      estadoPago: string;
      monto: number | string;
    }>,
  ): ReporteEgresoDto[] {
    return movimientos
      .map((m) => ({
        descripcion: m.descripcion ?? '',
        responsableNombre: m.responsable?.nombre ?? null,
        medioPago: m.medioPago,
        estadoPago: m.estadoPago,
        monto: Number(m.monto),
      }))
      .sort((a, b) => b.monto - a.monto);
  }

  private buildStock(rows: StockEntregaResponseDto[]): ReporteStockDto {
    const porProducto = new Map<string, ReporteStockProductoDto>();
    for (const row of rows) {
      const acc = porProducto.get(row.productoNombre) ?? {
        nombre: row.productoNombre,
        vendido: 0,
        entregado: 0,
        pendiente: 0,
      };
      acc.vendido += row.cantidadVendida;
      acc.entregado += row.cantidadEntregada;
      acc.pendiente += row.cantidadDisponible;
      porProducto.set(row.productoNombre, acc);
    }
    const productos = Array.from(porProducto.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
    return {
      productos,
      totalVendido: productos.reduce((s, p) => s + p.vendido, 0),
      totalEntregado: productos.reduce((s, p) => s + p.entregado, 0),
      totalPendiente: productos.reduce((s, p) => s + p.pendiente, 0),
    };
  }
}
