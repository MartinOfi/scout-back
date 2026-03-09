import {
  IsString,
  IsEnum,
  IsDate,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DestinoGanancia } from '../../../common/enums';

export class UpdateEventoDto {
  @ApiPropertyOptional({
    description: 'Nombre del evento',
    example: 'Venta de tortas',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  nombre?: string;

  @ApiPropertyOptional({
    description: 'Fecha del evento',
    example: '2025-07-20',
    type: String,
    format: 'date',
  })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fecha?: Date;

  @ApiPropertyOptional({
    description: 'Descripción del evento',
    example: 'Venta de tortas caseras para recaudar fondos',
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Destino de la ganancia del evento',
    enum: DestinoGanancia,
    example: DestinoGanancia.CUENTAS_PERSONALES,
  })
  @IsEnum(DestinoGanancia)
  @IsOptional()
  destinoGanancia?: DestinoGanancia;

  @ApiPropertyOptional({
    description: 'Subtipo de evento',
    example: 'Festival',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  tipoEvento?: string;
}
