import { ApiProperty } from '@nestjs/swagger';
import {
  TipoEvento,
  DestinoGanancia,
  PersonaType,
} from '../../../../common/enums';
import { REPORTE_SEVERIDAD, type ReporteSeveridad } from '../reporte.constants';

/**
 * Reusable building blocks for the event report contract.
 *
 * These DTOs are output-only (Swagger documentation); they carry no
 * class-validator decorators. Variant DTOs in `reporte-evento.dto.ts`
 * compose them.
 */

export class ReporteMetaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'VENTA LOCRO 25 MAYO' })
  nombre!: string;

  @ApiProperty({ example: '2026-05-25', description: 'Fecha del evento (ISO)' })
  fecha!: string;

  @ApiProperty({ enum: TipoEvento })
  tipo!: TipoEvento;

  @ApiProperty({ enum: DestinoGanancia, nullable: true })
  destinoGanancia!: DestinoGanancia | null;

  @ApiProperty({ example: false })
  estaCerrado!: boolean;
}

/**
 * KPIs comunes a todas las variantes.
 *
 * IMPORTANTE: `netoReal = recaudacionBruta - egresos` (NO `ingreso - egresos`),
 * porque el ingreso de venta ya descuenta el costo nominal del producto y
 * restarle los egresos reales contaría el costo dos veces.
 */
export class ReporteKpisDto {
  @ApiProperty({ example: 1796000, description: 'Σ precioVenta × cantidad' })
  recaudacionBruta!: number;

  @ApiProperty({
    example: 1426820,
    description:
      'Ganancia registrada = Σ (precioVenta − precioCosto) × cantidad',
  })
  ganancia!: number;

  @ApiProperty({ example: 514867.29, description: 'Σ egresos del evento' })
  egresos!: number;

  @ApiProperty({
    example: 1281132.71,
    description: 'Resultado neto real = recaudacionBruta − egresos',
  })
  netoReal!: number;

  @ApiProperty({
    example: 0.713,
    description: 'Margen neto sobre recaudación (0..1)',
  })
  margen!: number;

  @ApiProperty({
    example: 151,
    description: 'Unidades vendidas (eventos de venta)',
  })
  unidades!: number;

  @ApiProperty({ example: 0, description: 'Egresos pendientes de reembolso' })
  pendienteReembolso!: number;

  @ApiProperty({
    example: 369180,
    description:
      'Costo recuperado por el grupo (solo destino cuentas_personales): ' +
      'Σ precioCosto × cantidad devuelto a la caja grupo. 0 en otros destinos.',
  })
  recuperoCosto!: number;
}

export class ReporteEgresoDto {
  @ApiProperty({ example: 'carniceria' })
  descripcion!: string;

  @ApiProperty({ example: 'González, Ariel Gustavo', nullable: true })
  responsableNombre!: string | null;

  @ApiProperty({ example: 'efectivo' })
  medioPago!: string;

  @ApiProperty({ example: 'pagado' })
  estadoPago!: string;

  @ApiProperty({ example: 109241.65 })
  monto!: number;
}

export class ReporteIntegridadFlagDto {
  @ApiProperty({ enum: Object.values(REPORTE_SEVERIDAD) })
  severidad!: ReporteSeveridad;

  @ApiProperty({ example: 'El evento está ABIERTO: los datos pueden cambiar' })
  mensaje!: string;
}

export class ReporteProductoDto {
  @ApiProperty({ example: 'LOCRO' })
  nombre!: string;

  @ApiProperty({ example: 2500 })
  precioCosto!: number;

  @ApiProperty({ example: 12000 })
  precioVenta!: number;

  @ApiProperty({ example: 9500 })
  margenUnitario!: number;

  @ApiProperty({ example: 143 })
  unidades!: number;

  @ApiProperty({ example: 1716000 })
  recaudado!: number;

  @ApiProperty({
    example: 0.955,
    description: 'Porcentaje sobre recaudación (0..1)',
  })
  porcentaje!: number;
}

export class ReportePorTipoPersonaDto {
  @ApiProperty({ enum: PersonaType })
  tipo!: PersonaType;

  @ApiProperty({ example: 'Educadores' })
  label!: string;

  @ApiProperty({ example: 10 })
  vendedores!: number;

  @ApiProperty({ example: 91 })
  unidades!: number;

  @ApiProperty({ example: 1084000 })
  recaudado!: number;

  @ApiProperty({ example: 0.604 })
  porcentaje!: number;
}

/**
 * Participación por rama: cada rama cuenta SOLO protagonistas; los educadores
 * (de cualquier rama) se agrupan aparte con `esEducador = true`.
 */
export class ReportePorRamaDto {
  @ApiProperty({ example: 'Caminantes' })
  grupo!: string;

  @ApiProperty({ example: false })
  esEducador!: boolean;

  @ApiProperty({ example: 8 })
  vendedores!: number;

  @ApiProperty({ example: 36 })
  unidades!: number;

  @ApiProperty({ example: 430000 })
  recaudado!: number;

  @ApiProperty({ example: 0.239 })
  porcentaje!: number;
}

export class ReporteVendedorDto {
  @ApiProperty({ format: 'uuid' })
  vendedorId!: string;

  @ApiProperty({ example: 'Garcia, Matias Andres' })
  nombre!: string;

  @ApiProperty({ enum: PersonaType })
  tipo!: PersonaType;

  @ApiProperty({ example: 'Caminantes', nullable: true })
  rama!: string | null;

  @ApiProperty({ example: 43 })
  unidades!: number;

  @ApiProperty({ example: 508000 })
  recaudado!: number;

  @ApiProperty({ example: 0.283 })
  porcentaje!: number;

  @ApiProperty({ example: 28 })
  entregado!: number;

  @ApiProperty({ example: 15 })
  pendiente!: number;
}

export class ReporteStockProductoDto {
  @ApiProperty({ example: 'LOCRO' })
  nombre!: string;

  @ApiProperty({ example: 143 })
  vendido!: number;

  @ApiProperty({ example: 129 })
  entregado!: number;

  @ApiProperty({ example: 14 })
  pendiente!: number;
}

export class ReporteStockDto {
  @ApiProperty({ type: [ReporteStockProductoDto] })
  productos!: ReporteStockProductoDto[];

  @ApiProperty({ example: 151 })
  totalVendido!: number;

  @ApiProperty({ example: 136 })
  totalEntregado!: number;

  @ApiProperty({ example: 15 })
  totalPendiente!: number;
}

export class ReporteHorarioFranjaDto {
  @ApiProperty({
    example: '12:00',
    description: 'Inicio de la franja (hora AR)',
  })
  desde!: string;

  @ApiProperty({ example: '12:30' })
  hasta!: string;

  @ApiProperty({ example: 16 })
  entregas!: number;

  @ApiProperty({ example: 46 })
  porciones!: number;
}

export class ReporteEntregaFueraDiaDto {
  @ApiProperty({
    example: '2026-06-01',
    description: 'Día de registro (hora AR)',
  })
  dia!: string;

  @ApiProperty({ example: 3 })
  entregas!: number;

  @ApiProperty({ example: 3 })
  porciones!: number;
}

/**
 * Histograma de horarios de entrega del día del evento, en franjas de 30 min
 * (hora AR). `entrega.fecha` es null en la práctica, así que se usa
 * `createdAt`; las entregas registradas otro día se reportan en `fueraDeDia`.
 */
export class ReporteHorariosEntregaDto {
  @ApiProperty({
    example: '2026-05-25',
    description: 'Día principal del evento',
  })
  diaPrincipal!: string;

  @ApiProperty({ type: [ReporteHorarioFranjaDto] })
  franjas!: ReporteHorarioFranjaDto[];

  @ApiProperty({ example: 47 })
  totalEntregas!: number;

  @ApiProperty({ example: 130 })
  totalPorciones!: number;

  @ApiProperty({ type: [ReporteEntregaFueraDiaDto] })
  fueraDeDia!: ReporteEntregaFueraDiaDto[];
}

/** Bloque específico de eventos GRUPO: ingresos itemizados manuales. */
export class ReporteIngresoItemDto {
  @ApiProperty({ example: 'Venta de entradas' })
  descripcion!: string;

  @ApiProperty({ example: 'Tesorería', nullable: true })
  responsableNombre!: string | null;

  @ApiProperty({ example: 'efectivo' })
  medioPago!: string;

  @ApiProperty({ example: 50000 })
  monto!: number;

  @ApiProperty({ example: '2026-05-25T12:00:00.000Z' })
  fecha!: string;
}

/** Bloque específico de venta+cuentas_personales: ganancia por persona. */
export class ReporteGananciaPersonaDto {
  @ApiProperty({ format: 'uuid' })
  personaId!: string;

  @ApiProperty({ example: 'Garcia, Matias Andres' })
  nombre!: string;

  @ApiProperty({ example: 408500 })
  ganancia!: number;
}

/** Un lado de un evento mixto: lo que recaudó y le quedó a ese destino. */
export class ReporteDestinoLadoDto {
  @ApiProperty({ example: 320000, description: 'Precio de venta × unidades' })
  recaudado!: number;

  @ApiProperty({ example: 120000, description: 'Σ (venta − costo) × unidades' })
  ganancia!: number;

  @ApiProperty({ example: 240 })
  unidades!: number;

  @ApiProperty({
    example: 95000,
    description:
      'Plata registrada que todavía no entró (ventas en estado pendiente).',
  })
  pendienteCobro!: number;

  @ApiProperty({
    example: 80000,
    description:
      'Lo que efectivamente le queda a este destino. Para el grupo descuenta los egresos del evento y suma el recupero de costo; para las cuentas personales es la suma de márgenes, sin descuento de gastos.',
  })
  neto!: number;
}

/**
 * KPIs de un evento mixto abiertos por destino.
 *
 * Los gastos del evento se imputan 100% al grupo: la caja grupo ya recupera el
 * costo de la mercadería de las ventas personales vía el movimiento de
 * recupero, así que el resto de los egresos (transporte, permisos) son costo
 * del grupo y no reducen lo que reciben los chicos.
 */
export class ReportePorDestinoDto {
  @ApiProperty({ type: ReporteDestinoLadoDto })
  cajaGrupo!: ReporteDestinoLadoDto;

  @ApiProperty({ type: ReporteDestinoLadoDto })
  cuentasPersonales!: ReporteDestinoLadoDto;
}
