import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EstadoPersona,
  Rama,
  CargoEducador,
  TipoInscripcion,
  EstadoInscripcion,
  EstadoCuota,
  TipoMovimiento,
  MedioPago,
} from '../../../common/enums';

/**
 * Persona información básica para dashboard
 */
export class PersonaDashboardPersonaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  nombre!: string;

  @ApiProperty({ enum: ['Protagonista', 'Educador'] })
  tipo!: 'Protagonista' | 'Educador';

  @ApiProperty({ enum: EstadoPersona })
  estado!: EstadoPersona;

  @ApiProperty({ enum: Rama, nullable: true })
  rama!: Rama | null;

  @ApiPropertyOptional({ enum: CargoEducador })
  cargo?: CargoEducador;
}

/**
 * Cuenta personal con saldo calculado
 */
export class CuentaPersonalDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number, example: 5000 })
  saldo!: number;
}

/**
 * Documentación personal entregada (solo Protagonista)
 */
export class DocumentacionPersonalDto {
  @ApiProperty()
  partidaNacimiento!: boolean;

  @ApiProperty()
  dni!: boolean;

  @ApiProperty()
  dniPadres!: boolean;

  @ApiProperty()
  carnetObraSocial!: boolean;

  @ApiProperty({ description: 'Indica si toda la documentación está completa' })
  completa!: boolean;
}

/**
 * Autorizaciones de inscripción (solo Scout Argentina)
 */
export class AutorizacionesInscripcionDto {
  @ApiProperty()
  declaracionDeSalud!: boolean;

  @ApiProperty()
  autorizacionDeImagen!: boolean;

  @ApiProperty()
  salidasCercanas!: boolean;

  @ApiProperty()
  autorizacionIngreso!: boolean;

  @ApiProperty()
  certificadoAptitudFisica!: boolean;

  @ApiProperty({
    description: 'Indica si todas las autorizaciones están completas',
  })
  completas!: boolean;
}

/**
 * Item de inscripción para dashboard
 */
export class InscripcionDashboardItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TipoInscripcion })
  tipo!: TipoInscripcion;

  @ApiProperty({ example: 2026 })
  ano!: number;

  @ApiProperty({ type: Number })
  montoTotal!: number;

  @ApiProperty({ type: Number })
  montoBonificado!: number;

  @ApiProperty({ type: Number })
  montoPagado!: number;

  @ApiProperty({ type: Number })
  saldoPendiente!: number;

  @ApiProperty({ enum: EstadoInscripcion })
  estado!: EstadoInscripcion;

  @ApiPropertyOptional({ type: AutorizacionesInscripcionDto })
  autorizaciones?: AutorizacionesInscripcionDto;
}

/**
 * Resumen de inscripciones
 */
export class InscripcionesResumenDto {
  @ApiProperty({ type: Number, example: 5000 })
  total!: number;

  @ApiProperty({ example: 2 })
  cantidad!: number;
}

/**
 * Inscripciones para dashboard
 */
export class InscripcionesDashboardDto {
  @ApiProperty({ type: InscripcionesResumenDto })
  resumen!: InscripcionesResumenDto;

  @ApiProperty({ type: [InscripcionDashboardItemDto] })
  items!: InscripcionDashboardItemDto[];
}

/**
 * Item de cuota para dashboard
 */
export class CuotaDashboardItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Enero 2026' })
  nombre!: string;

  @ApiProperty({ example: 2026 })
  ano!: number;

  @ApiProperty({ type: Number })
  montoTotal!: number;

  @ApiProperty({ type: Number })
  montoPagado!: number;

  @ApiProperty({ type: Number })
  saldoPendiente!: number;

  @ApiProperty({ enum: EstadoCuota })
  estado!: EstadoCuota;
}

/**
 * Resumen de cuotas
 */
export class CuotasResumenDto {
  @ApiProperty({ type: Number, example: 3000 })
  total!: number;

  @ApiProperty({ example: 3 })
  cantidad!: number;
}

/**
 * Cuotas para dashboard
 */
export class CuotasDashboardDto {
  @ApiProperty({ type: CuotasResumenDto })
  resumen!: CuotasResumenDto;

  @ApiProperty({ type: [CuotaDashboardItemDto] })
  items!: CuotaDashboardItemDto[];
}

/**
 * Deuda total consolidada
 */
export class DeudaTotalDto {
  @ApiProperty({ type: Number, example: 8000 })
  total!: number;

  @ApiProperty({ type: Number, example: 5000 })
  inscripciones!: number;

  @ApiProperty({ type: Number, example: 3000 })
  cuotas!: number;
}

/**
 * Movimiento resumido para dashboard
 */
export class MovimientoDashboardDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '2026-03-12T10:30:00.000Z' })
  fecha!: string;

  @ApiProperty({ enum: TipoMovimiento })
  tipo!: TipoMovimiento;

  @ApiProperty({ example: 'Inscripción Scout Argentina 2026' })
  concepto!: string;

  @ApiProperty({ type: Number })
  monto!: number;

  @ApiProperty({ enum: MedioPago })
  medioPago!: MedioPago;
}

/**
 * DTO principal del dashboard de persona
 */
export class PersonaDashboardDto {
  @ApiProperty({ type: PersonaDashboardPersonaDto })
  persona!: PersonaDashboardPersonaDto;

  @ApiProperty({ type: CuentaPersonalDto })
  cuentaPersonal!: CuentaPersonalDto;

  @ApiPropertyOptional({ type: DocumentacionPersonalDto, nullable: true })
  documentacionPersonal?: DocumentacionPersonalDto | null;

  @ApiProperty({ type: InscripcionesDashboardDto })
  inscripciones!: InscripcionesDashboardDto;

  @ApiProperty({ type: CuotasDashboardDto })
  cuotas!: CuotasDashboardDto;

  @ApiProperty({ type: DeudaTotalDto })
  deudaTotal!: DeudaTotalDto;

  @ApiProperty({ type: [MovimientoDashboardDto] })
  ultimosMovimientos!: MovimientoDashboardDto[];
}
