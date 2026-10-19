import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ReportesService } from './reportes.service';
import { DeudaQueryDto } from './dtos/deuda-query.dto';
import { PersonaDeudaDto } from './dtos/deuda-consolidada.dto';
import { ConsolidadoDeudasDto } from './dtos/consolidado-deudas.dto';
import { DeudaConsolidadoQueryDto } from './dtos/deuda-consolidado-query.dto';

@ApiTags('reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('deudas')
  @Public()
  @ApiOperation({ summary: 'Reporte consolidado de deudas por persona' })
  @ApiResponse({ status: 200, type: [PersonaDeudaDto] })
  getDeudas(@Query() query: DeudaQueryDto): Promise<PersonaDeudaDto[]> {
    return this.reportesService.getDeudas(query);
  }

  @Get('deudas/consolidado')
  @ApiOperation({
    summary:
      'Consolidado de deuda por campamento e inscripción (solo orígenes con deuda)',
  })
  @ApiResponse({ status: 200, type: ConsolidadoDeudasDto })
  getConsolidado(
    @Query() query: DeudaConsolidadoQueryDto,
  ): Promise<ConsolidadoDeudasDto> {
    return this.reportesService.getConsolidado(query);
  }
}
