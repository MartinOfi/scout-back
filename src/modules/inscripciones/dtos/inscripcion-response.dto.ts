import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EstadoInscripcion,
  TipoInscripcion,
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  PersonaType,
  Rama,
} from '../../../common/enums';

/**
 * Embedded DTO for persona in inscription response
 */
export class PersonaInscripcionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Juan Perez' })
  nombre!: string;

  @ApiProperty({ enum: PersonaType, description: 'Tipo de persona' })
  tipo!: PersonaType;

  @ApiPropertyOptional({
    enum: Rama,
    nullable: true,
    description: 'Rama del protagonista/educador. Null para externos.',
  })
  rama!: Rama | null;
}

/**
 * Embedded DTO for movimientos related to an inscripcion
 */
export class MovimientoInscripcionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: Number })
  monto!: number;

  @ApiProperty({ enum: MedioPago })
  medioPago!: MedioPago;

  @ApiProperty()
  fecha!: Date;

  @ApiProperty({ nullable: true })
  descripcion!: string | null;

  @ApiProperty({ enum: TipoMovimiento })
  tipo!: TipoMovimiento;

  @ApiProperty({ enum: ConceptoMovimiento })
  concepto!: ConceptoMovimiento;
}

/**
 * Response DTO for Inscripcion with calculated payment fields
 */
export class InscripcionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  personaId!: string;

  @ApiProperty({ enum: TipoInscripcion })
  tipo!: TipoInscripcion;

  @ApiProperty()
  ano!: number;

  @ApiProperty({ type: Number })
  montoTotal!: number;

  @ApiProperty({ type: Number })
  montoBonificado!: number;

  // Campos de autorización (solo SCOUT_ARGENTINA)
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

  // Timestamps
  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  // Campos calculados
  @ApiProperty({
    enum: EstadoInscripcion,
    description: 'Estado de pago calculado desde movimientos',
  })
  estado!: EstadoInscripcion;

  @ApiProperty({
    type: Number,
    description: 'Total pagado en movimientos',
  })
  montoPagado!: number;

  @ApiProperty({
    type: Number,
    description:
      'Saldo pendiente de pago (montoTotal - montoBonificado - montoPagado)',
  })
  saldoPendiente!: number;

  // Persona relacionada (opcional, incluida en algunas consultas)
  @ApiPropertyOptional({ type: PersonaInscripcionDto })
  persona?: PersonaInscripcionDto;

  // Movimientos relacionados
  @ApiProperty({ type: [MovimientoInscripcionDto] })
  movimientos!: MovimientoInscripcionDto[];
}
