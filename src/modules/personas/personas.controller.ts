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
import { PersonasService } from './personas.service';
import { PersonasDashboardService } from './services/personas-dashboard.service';
import { CreateProtagonistaDto } from './dtos/create-protagonista.dto';
import { CreateEducadorDto } from './dtos/create-educador.dto';
import { CreatePersonaExternaDto } from './dtos/create-persona-externa.dto';
import { UpdatePersonaDto } from './dtos/update-persona.dto';
import { PersonaDashboardDto } from './dtos/persona-dashboard.dto';
import { PersonaType } from '../../common/enums';

@ApiTags('Personas')
@Controller('personas')
export class PersonasController {
  constructor(
    private readonly personasService: PersonasService,
    private readonly dashboardService: PersonasDashboardService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las personas' })
  @ApiQuery({ name: 'tipo', enum: PersonaType, required: false })
  @ApiQuery({ name: 'soloActivos', type: Boolean, required: false })
  @ApiResponse({ status: 200, description: 'Lista de personas' })
  async findAll(
    @Query('tipo') tipo?: PersonaType,
    @Query('soloActivos') soloActivos?: boolean,
  ) {
    if (soloActivos) {
      return this.personasService.findAllActivos();
    }
    if (tipo) {
      return this.personasService.findAllByTipo(tipo);
    }
    return this.personasService.findAll();
  }

  @Get('con-deudas')
  @ApiOperation({
    summary: 'Listar personas con deudas (incluyendo dados de baja)',
  })
  @ApiResponse({ status: 200, description: 'Lista de personas con deudas' })
  async findConDeudas() {
    return this.personasService.findConDeudas();
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Obtener dashboard consolidado de persona' })
  @ApiParam({ name: 'id', type: 'string', description: 'UUID de la persona' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard de la persona',
    type: PersonaDashboardDto,
  })
  @ApiResponse({ status: 400, description: 'Persona es PersonaExterna' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  async getDashboard(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PersonaDashboardDto> {
    return this.dashboardService.getDashboard(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una persona por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Persona encontrada' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.personasService.findOne(id);
  }

  @Post('protagonistas')
  @ApiOperation({ summary: 'Crear un protagonista' })
  @ApiResponse({ status: 201, description: 'Protagonista creado' })
  async createProtagonista(@Body() dto: CreateProtagonistaDto) {
    return this.personasService.createProtagonista(dto);
  }

  @Post('educadores')
  @ApiOperation({ summary: 'Crear un educador' })
  @ApiResponse({ status: 201, description: 'Educador creado' })
  async createEducador(@Body() dto: CreateEducadorDto) {
    return this.personasService.createEducador(dto);
  }

  @Post('externas')
  @ApiOperation({ summary: 'Crear una persona externa' })
  @ApiResponse({ status: 201, description: 'Persona externa creada' })
  async createPersonaExterna(@Body() dto: CreatePersonaExternaDto) {
    return this.personasService.createPersonaExterna(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una persona' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Persona actualizada' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePersonaDto,
  ) {
    return this.personasService.update(id, dto);
  }

  @Post(':id/dar-de-baja')
  @ApiOperation({
    summary: 'Dar de baja a una persona',
    description:
      'Transfiere saldo de cuenta personal a caja grupo y marca como inactivo',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Persona dada de baja',
    schema: {
      type: 'object',
      properties: {
        saldoTransferido: { type: 'number', example: 1500.5 },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  async darDeBaja(@Param('id', ParseUUIDPipe) id: string) {
    return this.personasService.darDeBaja(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una persona (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Persona eliminada' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.personasService.remove(id);
  }
}
