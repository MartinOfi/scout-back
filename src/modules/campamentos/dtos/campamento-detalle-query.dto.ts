import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FiltroMovimientosCampamento, Rama } from '../../../common/enums';

export class CampamentoDetalleQueryDto {
  @ApiPropertyOptional({
    enum: FiltroMovimientosCampamento,
    description:
      'Filtro de movimientos: todos (default), ingresos, gastos',
  })
  @IsOptional()
  @IsEnum(FiltroMovimientosCampamento)
  filtroMovimientos?: FiltroMovimientosCampamento;

  @ApiPropertyOptional({
    description: 'Filtrar participantes por nombre (búsqueda parcial, case-insensitive)',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    enum: Rama,
    description: 'Filtrar participantes por rama',
  })
  @IsOptional()
  @IsEnum(Rama)
  rama?: Rama;
}
