import {
  Controller,
  Get,
  Post,
  Patch,
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
import {
  CreateInscripcionDto,
  UpdateInscripcionDto,
  InscripcionResponseDto,
} from './dtos';
import { TipoInscripcion } from '../../common/enums';

@ApiTags('Inscripciones')
@Controller('inscripciones')
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todas las inscripciones con estado calculado',
  })
  @ApiQuery({ name: 'ano', type: Number, required: false })
  @ApiQuery({ name: 'tipo', enum: TipoInscripcion, required: false })
  @ApiResponse({
    status: 200,
    description: 'Lista de inscripciones con estado y saldo pendiente',
    type: [InscripcionResponseDto],
  })
  async findAll(
    @Query('ano') ano?: number,
    @Query('tipo') tipo?: TipoInscripcion,
  ): Promise<InscripcionResponseDto[]> {
    if (ano) {
      return this.inscripcionesService.findByAno(ano, tipo);
    }
    return this.inscripcionesService.findAll();
  }

  @Get('persona/:personaId')
  @ApiOperation({
    summary: 'Listar inscripciones de una persona con estado calculado',
  })
  @ApiParam({ name: 'personaId', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Inscripciones de la persona con estado y saldo pendiente',
    type: [InscripcionResponseDto],
  })
  async findByPersona(
    @Param('personaId', ParseUUIDPipe) personaId: string,
  ): Promise<InscripcionResponseDto[]> {
    return this.inscripcionesService.findByPersona(personaId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener una inscripción por ID con estado calculado',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Inscripción con estado, monto pagado y saldo pendiente',
    type: InscripcionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InscripcionResponseDto> {
    return this.inscripcionesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una inscripción' })
  @ApiResponse({
    status: 201,
    description: 'Inscripción creada con estado calculado',
    type: InscripcionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Ya existe inscripción para este año y tipo',
  })
  async create(
    @Body() dto: CreateInscripcionDto,
  ): Promise<InscripcionResponseDto> {
    return this.inscripcionesService.registrarInscripcion(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una inscripción (autorizaciones/bonificación)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Inscripción actualizada con estado recalculado',
    type: InscripcionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInscripcionDto,
  ): Promise<InscripcionResponseDto> {
    return this.inscripcionesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una inscripción (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inscripción eliminada' })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.inscripcionesService.remove(id);
  }
}
