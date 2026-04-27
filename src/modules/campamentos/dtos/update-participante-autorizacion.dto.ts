import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateParticipanteAutorizacionDto {
  @ApiProperty({
    example: true,
    description: 'Si el participante entregó la autorización',
  })
  @IsBoolean()
  autorizacionEntregada!: boolean;
}
