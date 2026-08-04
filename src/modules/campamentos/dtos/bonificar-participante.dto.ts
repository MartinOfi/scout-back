import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class BonificarParticipanteDto {
  @ApiProperty({
    description: 'Monto total bonificado deseado (no un delta)',
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monto!: number;
}
