import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddParticipanteDto {
  @ApiProperty({
    format: 'uuid',
    description: 'ID de la persona a agregar como participante',
  })
  @IsUUID()
  personaId!: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Si el participante ya entregó la autorización',
  })
  @IsBoolean()
  @IsOptional()
  autorizacionEntregada?: boolean;
}
