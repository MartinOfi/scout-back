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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InscripcionesService } from './inscripciones.service';
import {
  CreateInscripcionDto,
  UpdateInscripcionDto,
  PagarInscripcionDto,
  InscripcionResponseDto,
  GetInscripcionesQueryDto,
  InscripcionesConsolidadoDto,
} from './dtos';

@ApiTags('Inscripciones')
@Controller('inscripciones')
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todas las inscripciones con estado calculado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de inscripciones con estado y saldo pendiente',
    type: [InscripcionResponseDto],
  })
  async findAll(
    @Query() query: GetInscripcionesQueryDto,
  ): Promise<InscripcionResponseDto[]> {
    return this.inscripcionesService.findAll(query);
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

  @Get('consolidado')
  @ApiOperation({
    summary: 'Obtener estadísticas consolidadas de inscripciones',
    description:
      'Retorna totales por rama, resumen financiero y desglose de deudores. ' +
      'Acepta filtros por año, tipo de inscripción y tipo de deuda.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas consolidadas de inscripciones',
    type: InscripcionesConsolidadoDto,
  })
  async getConsolidado(
    @Query() query: GetInscripcionesQueryDto,
  ): Promise<InscripcionesConsolidadoDto> {
    return this.inscripcionesService.getConsolidado(query);
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
    @CurrentUser('id') userId: string,
  ): Promise<InscripcionResponseDto> {
    return this.inscripcionesService.registrarInscripcion(dto, userId);
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

  @Post(':id/pagar')
  @ApiOperation({
    summary: 'Registrar un pago para una inscripción',
    description:
      'Permite realizar pagos parciales o totales, opcionalmente usando saldo de la caja personal',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Pago registrado exitosamente',
    type: InscripcionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  @ApiResponse({
    status: 400,
    description:
      'Error de validación (inscripción ya pagada, monto excede saldo pendiente, saldo personal insuficiente)',
  })
  async pagar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PagarInscripcionDto,
    @CurrentUser('id') userId: string,
  ): Promise<InscripcionResponseDto> {
    return this.inscripcionesService.pagar(id, dto, userId);
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
