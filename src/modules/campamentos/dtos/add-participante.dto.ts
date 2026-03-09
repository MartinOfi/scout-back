import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddParticipanteDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID de la persona a agregar como participante',
  })
  @IsUUID()
  personaId!: string;
}
