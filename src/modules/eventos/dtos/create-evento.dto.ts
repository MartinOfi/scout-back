import {
  IsString,
  IsEnum,
  IsDate,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoEvento, DestinoGanancia } from '../../../common/enums';

export class CreateEventoDto {
  @ApiProperty({
    description: 'Nombre del evento',
    example: 'Venta de empanadas',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  nombre!: string;

  @ApiProperty({
    description: 'Fecha del evento',
    example: '2025-06-15',
    type: String,
    format: 'date',
  })
  @IsDate()
  @Type(() => Date)
  fecha!: Date;

  @ApiPropertyOptional({
    description: 'Descripción del evento',
    example: 'Venta de empanadas para recaudar fondos para el campamento',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({
    description: 'Tipo de evento',
    enum: TipoEvento,
    example: TipoEvento.VENTA,
  })
  @IsEnum(TipoEvento)
  tipo!: TipoEvento;

  @ApiPropertyOptional({
    description:
      'Destino de la ganancia del evento (solo para eventos de venta)',
    enum: DestinoGanancia,
    example: DestinoGanancia.CAJA_GRUPO,
  })
  @IsEnum(DestinoGanancia)
  @IsOptional()
  destinoGanancia?: DestinoGanancia;

  @ApiPropertyOptional({
    description: 'Subtipo de evento (para categorización adicional)',
    example: 'Kermesse',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  tipoEvento?: string;
}
