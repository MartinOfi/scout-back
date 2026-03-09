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
  ApiBody,
} from '@nestjs/swagger';
import { InscripcionesService } from './inscripciones.service';
import { CreateInscripcionDto } from './dtos/create-inscripcion.dto';
import { MedioPago } from '../../common/enums';

@ApiTags('Inscripciones')
@Controller('inscripciones')
export class InscripcionesController {
  constructor(private readonly inscripcionesService: InscripcionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las inscripciones' })
  @ApiQuery({ name: 'ano', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Lista de inscripciones' })
  async findAll(@Query('ano') ano?: number) {
    if (ano) {
      return this.inscripcionesService.findByAno(ano);
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
  @ApiOperation({ summary: 'Obtener una inscripción por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Inscripción encontrada' })
  @ApiResponse({ status: 404, description: 'Inscripción no encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inscripcionesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una inscripción' })
  @ApiResponse({ status: 201, description: 'Inscripción creada' })
  @ApiResponse({
    status: 400,
    description: 'Ya existe inscripción para este año',
  })
  async create(@Body() dto: CreateInscripcionDto) {
    return this.inscripcionesService.create(dto);
  }

  @Post(':id/pago')
  @ApiOperation({ summary: 'Registrar un pago de inscripción' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['monto', 'medioPago', 'responsableId'],
      properties: {
        monto: { type: 'number', example: 5000 },
        medioPago: { type: 'string', enum: ['efectivo', 'transferencia'] },
        responsableId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Pago registrado' })
  @ApiResponse({ status: 400, description: 'Error de validación' })
  async registrarPago(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('monto') monto: number,
    @Body('medioPago') medioPago: MedioPago,
    @Body('responsableId', ParseUUIDPipe) responsableId: string,
  ) {
    return this.inscripcionesService.registrarPago(
      id,
      monto,
      medioPago,
      responsableId,
    );
  }

  @Post(':id/pago-scout-argentina')
  @ApiOperation({ summary: 'Registrar pago a Scout Argentina' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['monto', 'medioPago'],
      properties: {
        monto: { type: 'number', example: 15000 },
        medioPago: { type: 'string', enum: ['efectivo', 'transferencia'] },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Pago a Scout Argentina registrado',
  })
  async registrarPagoScoutArgentina(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('monto') monto: number,
    @Body('medioPago') medioPago: MedioPago,
  ) {
    return this.inscripcionesService.registrarPagoScoutArgentina(
      id,
      monto,
      medioPago,
    );
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
