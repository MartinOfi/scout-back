import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CajaType } from '../../../common/enums';

export class CreateCajaDto {
  @ApiProperty({
    description: 'Tipo de caja',
    enum: CajaType,
    example: CajaType.GRUPO,
  })
  @IsEnum(CajaType)
  tipo!: CajaType;

  @ApiPropertyOptional({
    description:
      'Nombre de la caja (requerido para cajas de rama o personales)',
    example: 'Caja Rama Lobatos',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({
    description: 'ID del propietario (persona) para cajas personales',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  propietarioId?: string;
}
