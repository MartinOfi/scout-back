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
import { InscripcionesService } from './inscripciones.service';
import { CreateInscripcionDto } from './dtos/create-inscripcion.dto';
import { TipoInscripcion } from '../../common/enums';

@ApiTags('Inscripciones')
@Controller('inscripciones')
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las inscripciones' })
  @ApiQuery({ name: 'ano', type: Number, required: false })
  @ApiQuery({ name: 'tipo', enum: TipoInscripcion, required: false })
  @ApiResponse({ status: 200, description: 'Lista de inscripciones' })
  async findAll(
    @Query('ano') ano?: number,
    @Query('tipo') tipo?: TipoInscripcion,
  ) {
    if (ano) {
      return this.inscripcionesService.findByAno(ano, tipo);
    }
    return this.inscripcionesService.findAll();
  }

  @Get('persona/:personaId')
  @ApiOperation({ summary: 'Listar inscripciones de una persona' })
  @ApiParam({ name: 'personaId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inscripciones de la persona' })
  async findByPersona(@Param('personaId', ParseUUIDPipe) personaId: string) {
    return this.inscripcionesService.findByPersona(personaId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una inscripción por ID con estado calculado',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Inscripción con estado y monto pagado',
  })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inscripcionesService.findOneWithEstado(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una inscripción' })
  @ApiResponse({ status: 201, description: 'Inscripción creada' })
  @ApiResponse({
    status: 400,
    description: 'Ya existe inscripción para este año y tipo',
  })
  async create(@Body() dto: CreateInscripcionDto) {
    return this.inscripcionesService.registrarInscripcion(dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una inscripción (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inscripción eliminada' })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inscripcionesService.remove(id);
  }
}
