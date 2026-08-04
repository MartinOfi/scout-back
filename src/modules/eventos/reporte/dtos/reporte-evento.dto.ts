import { ApiProperty } from '@nestjs/swagger';
import { REPORTE_VARIANTE } from '../reporte.constants';
import {
  ReporteEgresoDto,
  ReporteGananciaPersonaDto,
  ReporteHorariosEntregaDto,
  ReporteIngresoItemDto,
  ReporteIntegridadFlagDto,
  ReporteKpisDto,
  ReporteMetaDto,
  ReportePorRamaDto,
  ReportePorTipoPersonaDto,
  ReporteProductoDto,
  ReporteStockDto,
  ReporteVendedorDto,
  ReportePorDestinoDto,
} from './reporte-bloques.dto';

/**
 * Base común a todas las variantes de reporte.
 * Las variantes concretas agregan sus bloques específicos.
 */
export abstract class ReporteBaseDto {
  @ApiProperty({ example: '2026-06-01T22:00:00.000Z' })
  generadoEn!: string;

  @ApiProperty({ type: ReporteMetaDto })
  evento!: ReporteMetaDto;

  @ApiProperty({ type: ReporteKpisDto })
  kpis!: ReporteKpisDto;

  @ApiProperty({ type: [ReporteEgresoDto] })
  egresos!: ReporteEgresoDto[];

  @ApiProperty({ type: [ReporteIntegridadFlagDto] })
  integridad!: ReporteIntegridadFlagDto[];
}

/** Bloques compartidos por todas las variantes de evento VENTA. */
export abstract class ReporteVentaBaseDto extends ReporteBaseDto {
  @ApiProperty({ type: [ReporteProductoDto] })
  productos!: ReporteProductoDto[];

  @ApiProperty({ type: [ReportePorTipoPersonaDto] })
  porTipoPersona!: ReportePorTipoPersonaDto[];

  @ApiProperty({ type: [ReportePorRamaDto] })
  porRama!: ReportePorRamaDto[];

  @ApiProperty({ type: [ReporteVendedorDto] })
  vendedores!: ReporteVendedorDto[];

  @ApiProperty({ type: ReporteStockDto })
  stock!: ReporteStockDto;

  @ApiProperty({ type: ReporteHorariosEntregaDto })
  horariosEntrega!: ReporteHorariosEntregaDto;
}

export class ReporteVentaCajaGrupoDto extends ReporteVentaBaseDto {
  @ApiProperty({ enum: [REPORTE_VARIANTE.VENTA_CAJA_GRUPO] })
  variante!: typeof REPORTE_VARIANTE.VENTA_CAJA_GRUPO;
}

export class ReporteVentaCuentasPersonalesDto extends ReporteVentaBaseDto {
  @ApiProperty({ enum: [REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES] })
  variante!: typeof REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES;

  @ApiProperty({
    type: [ReporteGananciaPersonaDto],
    description: 'Payout de ganancia a cada cuenta personal',
  })
  gananciaPorPersona!: ReporteGananciaPersonaDto[];
}

export class ReporteVentaMixtaDto extends ReporteVentaBaseDto {
  @ApiProperty({ enum: [REPORTE_VARIANTE.VENTA_MIXTA] })
  variante!: typeof REPORTE_VARIANTE.VENTA_MIXTA;

  @ApiProperty({
    type: ReportePorDestinoDto,
    description:
      'Los mismos KPIs abiertos por destino. Los gastos del evento se imputan 100% al grupo, así que el neto personal es la suma de márgenes sin descuento.',
  })
  porDestino!: ReportePorDestinoDto;

  @ApiProperty({
    type: [ReporteGananciaPersonaDto],
    description:
      'Payout a cuentas personales. Sólo cuenta las ventas con destino cuentas_personales.',
  })
  gananciaPorPersona!: ReporteGananciaPersonaDto[];
}

export class ReporteGrupoDto extends ReporteBaseDto {
  @ApiProperty({ enum: [REPORTE_VARIANTE.GRUPO] })
  variante!: typeof REPORTE_VARIANTE.GRUPO;

  @ApiProperty({ type: [ReporteIngresoItemDto] })
  ingresosItemizados!: ReporteIngresoItemDto[];
}

/**
 * Unión discriminada por `variante`. El consumidor (frontend) la estrecha
 * con ese campo para elegir el set de secciones a renderizar.
 */
export type ReporteEventoDto =
  | ReporteVentaCajaGrupoDto
  | ReporteVentaCuentasPersonalesDto
  | ReporteVentaMixtaDto
  | ReporteGrupoDto;

/** Todas las clases concretas, para @ApiExtraModels y oneOf en Swagger. */
export const REPORTE_EVENTO_DTOS = [
  ReporteVentaCajaGrupoDto,
  ReporteVentaCuentasPersonalesDto,
  ReporteVentaMixtaDto,
  ReporteGrupoDto,
] as const;
