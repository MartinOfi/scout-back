import {
  IsArray,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  IsInt,
  IsPositive,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MedioPago,
  DestinoGanancia,
  EstadoCobroVenta,
} from '../../../common/enums';

export class VentaItemDto {
  @ApiProperty({
    description: 'ID del producto vendido',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  @IsUUID()
  productoId!: string;

  @ApiProperty({
    description: 'Cantidad vendida de este producto',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @IsPositive()
  cantidad!: number;
}

export class RegisterVentasLoteDto {
  @ApiProperty({
    description:
      'ID del vendedor. Puede ser un protagonista, un educador o una AGRUPACION (ej. "Grupo Scout") cuando vendió el grupo y no una persona en particular.',
    example: '550e8400-e29b-41d4-a716-446655440002',
    format: 'uuid',
  })
  @IsUUID()
  vendedorId!: string;

  @ApiPropertyOptional({
    description:
      'Quién responde por esta plata. Por defecto es el vendedor; se especifica cuando vende una agrupación y hay un educador a cargo de la caja.',
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  responsableId?: string;

  @ApiPropertyOptional({
    description:
      'Destino de la ganancia de este lote. OBLIGATORIO si el evento es de modalidad MIXTA; PROHIBIDO si es UNICA (se hereda del evento).',
    enum: DestinoGanancia,
  })
  @IsEnum(DestinoGanancia)
  @IsOptional()
  destinoGanancia?: DestinoGanancia;

  @ApiPropertyOptional({
    description:
      'PENDIENTE registra la venta sin que haya entrado la plata (ej. pedido por WhatsApp). El movimiento nace en pendiente_cobro y no mueve el saldo de la caja hasta que se cobre.',
    enum: EstadoCobroVenta,
    default: EstadoCobroVenta.COBRADO,
  })
  @IsEnum(EstadoCobroVenta)
  @IsOptional()
  estadoCobro?: EstadoCobroVenta;

  @ApiPropertyOptional({
    description:
      'true cuando el producto se entregó en el acto: crea la entrega junto con la venta, en la misma transacción, y el stock pendiente queda en cero. false (default) es preventa.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  entregaInmediata?: boolean;

  @ApiProperty({
    description: 'Medio de pago de las ventas',
    enum: MedioPago,
    example: MedioPago.EFECTIVO,
  })
  @IsEnum(MedioPago)
  medioPago!: MedioPago;

  @ApiProperty({
    description: 'Lista de productos vendidos con sus cantidades',
    type: [VentaItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => VentaItemDto)
  items!: VentaItemDto[];
}
