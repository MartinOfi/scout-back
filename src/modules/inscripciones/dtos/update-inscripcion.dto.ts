import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para actualizar una inscripción existente.
 * Solo permite actualizar montos y autorizaciones.
 */
export class UpdateInscripcionDto {
  @ApiPropertyOptional({
    example: 5000.0,
    minimum: 0,
    description: 'Monto bonificado',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  montoBonificado?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Declaración de salud presentada',
  })
  @IsBoolean()
  @IsOptional()
  declaracionDeSalud?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Autorización de uso de imagen',
  })
  @IsBoolean()
  @IsOptional()
  autorizacionDeImagen?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Autorización para salidas cercanas',
  })
  @IsBoolean()
  @IsOptional()
  salidasCercanas?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Autorización de ingreso al grupo',
  })
  @IsBoolean()
  @IsOptional()
  autorizacionIngreso?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Certificado de aptitud física presentado',
  })
  @IsBoolean()
  @IsOptional()
  certificadoAptitudFisica?: boolean;
}
