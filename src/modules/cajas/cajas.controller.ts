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
import { CreateCajaDto } from './dtos/create-caja.dto';
import { CajaType } from '../../common/enums';

@ApiTags('Cajas')
@Controller('cajas')
export class CajasController {
  constructor(private readonly cajasService: CajasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las cajas' })
  @ApiQuery({ name: 'tipo', enum: CajaType, required: false })
  @ApiResponse({ status: 200, description: 'Lista de cajas' })
  async findAll(@Query('tipo') tipo?: CajaType) {
    if (tipo) {
      return this.cajasService.findByTipo(tipo);
    }
    return this.cajasService.findAll();
  }

  @Get('grupo')
  @ApiOperation({ summary: 'Obtener la caja del grupo' })
  @ApiResponse({ status: 200, description: 'Caja del grupo' })
  @ApiResponse({ status: 404, description: 'Caja del grupo no encontrada' })
  async findCajaGrupo() {
    return this.cajasService.findCajaGrupo();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una caja por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Caja encontrada' })
  @ApiResponse({ status: 404, description: 'Caja no encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
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
