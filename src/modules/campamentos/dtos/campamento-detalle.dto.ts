import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
  EstadoPagoCampamento,
  PersonaType,
  Rama,
} from '../../../common/enums';

/**
 * Basic campamento information for detail view
 */
export class CampamentoInfoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Campamento de Verano 2026' })
  nombre!: string;

  @ApiProperty({ example: '2026-01-15', type: String, format: 'date' })
  fechaInicio!: Date;

  @ApiProperty({ example: '2026-01-22', type: String, format: 'date' })
  fechaFin!: Date;

  @ApiProperty({ type: Number, example: 25000 })
  costoPorPersona!: number;

  @ApiProperty({ example: 3 })
  cuotasBase!: number;

  @ApiPropertyOptional({ example: 'Campamento anual en Sierra de la Ventana' })
  descripcion!: string | null;
}

/**
 * Individual payment record for a participant
 */
export class PagoParticipanteDto {
  @ApiProperty({ format: 'uuid' })
  movimientoId!: string;

  @ApiProperty({ example: '2026-01-10T10:30:00.000Z' })
  fecha!: Date;

  @ApiProperty({ type: Number, example: 8000 })
  monto!: number;

  @ApiProperty({ enum: MedioPago })
  medioPago!: MedioPago;
}

/**
 * Participant with payment status
 */
export class ParticipantePagoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  nombre!: string;

  @ApiProperty({ enum: PersonaType })
  tipo!: PersonaType;

  @ApiPropertyOptional({ enum: Rama, nullable: true })
  rama!: Rama | null;

  @ApiProperty({ type: Number, example: 25000 })
  costoPorPersona!: number;

  @ApiProperty({ type: Number, example: 16000 })
  totalPagado!: number;

  @ApiProperty({ type: Number, example: 9000 })
  saldoPendiente!: number;

  @ApiProperty({ enum: EstadoPagoCampamento })
  estadoPago!: EstadoPagoCampamento;

  @ApiProperty({ type: [PagoParticipanteDto] })
  pagos!: PagoParticipanteDto[];
}

/**
 * Movement summary for campamento detail view
 */
export class MovimientoCampamentoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-01-10T10:30:00.000Z' })
  fecha!: Date;

  @ApiProperty({ enum: TipoMovimiento })
  tipo!: TipoMovimiento;

  @ApiProperty({ enum: ConceptoMovimiento })
  concepto!: ConceptoMovimiento;

  @ApiProperty({ type: Number, example: 8000 })
  monto!: number;

  @ApiPropertyOptional({ example: 'Pago campamento "Campamento de Verano"' })
  descripcion!: string | null;

  @ApiProperty({ enum: MedioPago })
  medioPago!: MedioPago;

  @ApiProperty({ enum: EstadoPago })
  estadoPago!: EstadoPago;

  @ApiProperty({ format: 'uuid', description: 'ID of the responsible person' })
  responsableId!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  responsableNombre!: string;
}

/**
 * KPIs for campamento financial health
 */
export class CampamentoKpisDto {
  @ApiProperty({
    type: Number,
    example: 250000,
    description: 'Total a recaudar = costoPorPersona * participantes.length',
  })
  totalARecaudar!: number;

  @ApiProperty({
    type: Number,
    example: 180000,
    description: 'Suma de todos los movimientos CAMPAMENTO_PAGO (INGRESO)',
  })
  totalRecaudado!: number;

  @ApiProperty({
    type: Number,
    example: 45000,
    description:
      'Egresos CAMPAMENTO_GASTO con estadoPago=PAGADO. Impacta directamente en la caja del grupo.',
  })
  totalGastadoEfectivo!: number;

  @ApiProperty({
    type: Number,
    example: 5000,
    description:
      'Egresos CAMPAMENTO_GASTO con estadoPago=PENDIENTE_REEMBOLSO. Comprometidos pero no salieron de caja aún.',
  })
  totalPendienteReembolso!: number;

  @ApiProperty({
    type: Number,
    example: 135000,
    description:
      'totalRecaudado - totalGastadoEfectivo. Saldo real disponible en la caja del grupo.',
  })
  balance!: number;

  @ApiProperty({
    type: Number,
    example: 70000,
    description: 'totalARecaudar - totalRecaudado',
  })
  deudaTotal!: number;

  @ApiProperty({
    example: 10,
    description: 'Total de participantes',
  })
  cantidadParticipantes!: number;

  @ApiProperty({
    example: 3,
    description: 'Participantes con pago completo',
  })
  participantesPagadosCompleto!: number;

  @ApiProperty({
    example: 4,
    description: 'Participantes con pago parcial',
  })
  participantesPagadosParcial!: number;

  @ApiProperty({
    example: 3,
    description: 'Participantes sin pago',
  })
  participantesPendientes!: number;
}

/**
 * Complete campamento detail response
 */
export class CampamentoDetalleDto {
  @ApiProperty({ type: CampamentoInfoDto })
  campamento!: CampamentoInfoDto;

  @ApiProperty({ type: [ParticipantePagoDto] })
  participantes!: ParticipantePagoDto[];

  @ApiProperty({ type: [MovimientoCampamentoDto] })
  movimientos!: MovimientoCampamentoDto[];

  @ApiProperty({ type: CampamentoKpisDto })
  kpis!: CampamentoKpisDto;
}
