import {
  IsNumber,
  IsUUID,
  IsPositive,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInscripcionDto {
  @ApiProperty({ format: 'uuid', description: 'ID de la persona' })
  @IsUUID()
  personaId!: string;

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
    example: true,
    description: 'Aplicar bonificación si es protagonista nuevo',
  })
  @IsBoolean()
  @IsOptional()
  aplicarBonificacion?: boolean;
}
