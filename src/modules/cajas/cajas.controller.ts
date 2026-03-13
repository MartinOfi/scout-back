import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CajasService } from './cajas.service';
import { CreateCajaDto, ConsolidadoSaldosDto, CajaResponseDto } from './dtos';
import { CajaType } from '../../common/enums';

@ApiTags('Cajas')
@Controller('cajas')
export class CajasController {
  constructor(private readonly cajasService: CajasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las cajas con saldo actual' })
  @ApiQuery({ name: 'tipo', enum: CajaType, required: false })
  @ApiResponse({
    status: 200,
    description: 'Lista de cajas con saldo calculado',
    type: [CajaResponseDto],
  })
  async findAll(@Query('tipo') tipo?: CajaType): Promise<CajaResponseDto[]> {
    if (tipo) {
      return this.cajasService.findByTipo(tipo);
    }
    return this.cajasService.findAll();
  }

  @Get('grupo')
  @ApiOperation({ summary: 'Obtener la caja del grupo con saldo actual' })
  @ApiResponse({
    status: 200,
    description: 'Caja del grupo con saldo calculado',
    type: CajaResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Caja del grupo no encontrada' })
  async findCajaGrupo(): Promise<CajaResponseDto> {
    return this.cajasService.findCajaGrupo();
  }

  @Get('consolidado')
  @ApiOperation({ summary: 'Obtener consolidado de saldos de todas las cajas' })
  @ApiResponse({
    status: 200,
    description: 'Consolidado de saldos',
    type: ConsolidadoSaldosDto,
  })
  async getConsolidadoSaldos(): Promise<ConsolidadoSaldosDto> {
    return this.cajasService.getConsolidadoSaldos();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una caja por ID con saldo actual' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Caja encontrada con saldo calculado',
    type: CajaResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Caja no encontrada' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CajaResponseDto> {
    return this.cajasService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una caja' })
  @ApiResponse({ status: 201, description: 'Caja creada' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  async create(@Body() dto: CreateCajaDto) {
    return this.cajasService.create(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una caja (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Caja eliminada' })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar la caja del grupo',
  })
  @ApiResponse({ status: 404, description: 'Caja no encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.cajasService.remove(id);
  }
}
