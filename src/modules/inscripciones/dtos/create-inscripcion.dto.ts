import {
  IsNumber,
  IsUUID,
  IsPositive,
  IsEnum,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoInscripcion, MedioPago } from '../../../common/enums';

export class CreateInscripcionDto {
  @ApiProperty({ format: 'uuid', description: 'ID de la persona' })
  @IsUUID()
  personaId!: string;

  @ApiProperty({
    enum: TipoInscripcion,
    example: TipoInscripcion.GRUPO,
    description: 'Tipo de inscripción',
  })
  @IsEnum(TipoInscripcion)
  tipo!: TipoInscripcion;

  @ApiProperty({ example: 2026, minimum: 2020, maximum: 2100 })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  ano!: number;

  @ApiProperty({
    example: 15000.0,
    minimum: 0.01,
    description: 'Monto total de la inscripción',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  montoTotal!: number;

  @ApiPropertyOptional({
    example: 5000.0,
    minimum: 0,
    description: 'Monto bonificado (default: 0)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoBonificado?: number;

  // =========================================================================
  // Documentación y autorizaciones
  // =========================================================================

  @ApiPropertyOptional({
    example: false,
    description: 'Declaración de salud presentada (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  declaracionDeSalud?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Autorización de uso de imagen (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  autorizacionDeImagen?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Autorización para salidas cercanas (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  salidasCercanas?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Autorización de ingreso al grupo (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  autorizacionIngreso?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Certificado de aptitud física presentado (default: false)',
  })
  @IsBoolean()
  @IsOptional()
  certificadoAptitudFisica?: boolean;

  // =========================================================================
  // Pago inicial (opcional)
  // =========================================================================

  @ApiPropertyOptional({
    example: 5000.0,
    minimum: 0,
    description:
      'Monto pagado en efectivo/transferencia (default: 0). NO incluye el monto de saldo personal.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoPagado?: number;

  @ApiPropertyOptional({
    enum: MedioPago,
    example: MedioPago.EFECTIVO,
    description:
      'Medio de pago para montoPagado (solo aplica si montoPagado > 0)',
  })
  @IsEnum(MedioPago)
  @IsOptional()
  medioPago?: MedioPago;

  @ApiPropertyOptional({
    example: 3000.0,
    minimum: 0,
    description:
      'Monto a descontar de la caja personal (default: 0). Independiente de montoPagado. Total ingresado = montoPagado + montoConSaldoPersonal.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoConSaldoPersonal?: number;
}
