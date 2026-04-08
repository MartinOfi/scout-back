import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MedioPago } from '../../../common/enums';

export class CerrarEventoVentaDto {
  @ApiProperty({
    description: 'Medio de pago con el que se liquidan las ganancias',
    enum: MedioPago,
    example: MedioPago.EFECTIVO,
  })
  @IsEnum(MedioPago)
  medioPago!: MedioPago;
}
