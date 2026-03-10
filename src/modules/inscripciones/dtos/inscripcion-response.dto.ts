import { ApiProperty } from '@nestjs/swagger';
import {
  EstadoInscripcion,
  TipoInscripcion,
  MedioPago,
} from '../../../common/enums';

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
  @ApiProperty({ required: false })
  persona?: {
    id: string;
    nombre: string;
  };

  // Movimientos relacionados
  @ApiProperty({ type: [MovimientoInscripcionDto] })
  movimientos!: MovimientoInscripcionDto[];
}
