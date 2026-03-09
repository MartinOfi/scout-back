import {
  IsString,
  IsEnum,
  IsNumber,
  IsDate,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsPositive,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
} from '../../../common/enums';

export class CreateMovimientoDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID de la caja donde se registra el movimiento',
  })
  @IsUUID()
  cajaId!: string;

  @ApiProperty({ enum: TipoMovimiento, example: TipoMovimiento.INGRESO })
  @IsEnum(TipoMovimiento)
  tipo!: TipoMovimiento;

  @ApiProperty({ example: 1500.5, minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number;

  @ApiProperty({
    enum: ConceptoMovimiento,
    example: ConceptoMovimiento.CUOTA_GRUPO,
  })
  @IsEnum(ConceptoMovimiento)
  concepto!: ConceptoMovimiento;

  @ApiPropertyOptional({
    example: 'Pago inscripción Scout Argentina 2026',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Persona responsable del movimiento',
  })
  @IsUUID()
  responsableId!: string;

  @ApiProperty({ enum: MedioPago, example: MedioPago.EFECTIVO })
  @IsEnum(MedioPago)
  medioPago!: MedioPago;

  @ApiPropertyOptional({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  requiereComprobante?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  comprobanteEntregado?: boolean;

  @ApiProperty({ enum: EstadoPago, example: EstadoPago.PAGADO })
  @IsEnum(EstadoPago)
  estadoPago!: EstadoPago;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Persona a reembolsar (si aplica)',
  })
  @IsUUID()
  @IsOptional()
  personaAReembolsarId?: string;

  @ApiPropertyOptional({
    example: '2026-02-09T10:30:00Z',
    type: String,
    format: 'date-time',
    description: 'Fecha del movimiento (por defecto: fecha actual)',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fecha?: Date;

  @ApiPropertyOptional({ format: 'uuid', description: 'Evento relacionado' })
  @IsUUID()
  @IsOptional()
  eventoId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Campamento relacionado',
  })
  @IsUUID()
  @IsOptional()
  campamentoId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Inscripción relacionada',
  })
  @IsUUID()
  @IsOptional()
  inscripcionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Cuota relacionada' })
  @IsUUID()
  @IsOptional()
  cuotaId?: string;
}
