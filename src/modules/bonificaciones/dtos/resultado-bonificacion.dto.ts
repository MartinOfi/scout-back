import { ApiProperty } from '@nestjs/swagger';

export class ResultadoBonificacionDto {
  @ApiProperty() movimientoEgresoId!: string;
  @ApiProperty() movimientoIngresoId!: string;
  @ApiProperty() monto!: number;
  @ApiProperty() saldoFondoRestante!: number;
}
