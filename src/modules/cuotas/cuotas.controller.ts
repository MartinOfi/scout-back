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
import { CuotasService } from './cuotas.service';
import { CreateCuotaDto } from './dtos/create-cuota.dto';
import { MedioPago } from '../../common/enums';

@ApiTags('Cuotas')
@Controller('cuotas')
export class CuotasController {
  constructor(private readonly cuotasService: CuotasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las cuotas' })
  @ApiQuery({ name: 'ano', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Lista de cuotas' })
  async findAll(@Query('ano') ano?: number) {
    if (ano) {
      return this.cuotasService.findByAno(ano);
    }
    return this.cuotasService.findAll();
  }

  @Get('persona/:personaId')
  @ApiOperation({ summary: 'Listar cuotas de una persona' })
  @ApiParam({ name: 'personaId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cuotas de la persona' })
  async findByPersona(@Param('personaId', ParseUUIDPipe) personaId: string) {
    return this.cuotasService.findByPersona(personaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una cuota por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cuota encontrada' })
  @ApiResponse({ status: 404, description: 'Cuota no encontrada' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuotasService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una cuota' })
  @ApiResponse({ status: 201, description: 'Cuota creada' })
  async create(@Body() dto: CreateCuotaDto) {
    return this.cuotasService.create(dto);
  }

  @Post(':id/pago')
  @ApiOperation({ summary: 'Registrar un pago de cuota' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['monto', 'medioPago', 'responsableId'],
      properties: {
        monto: { type: 'number', example: 2000 },
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
    return this.cuotasService.registrarPago(
      id,
      monto,
      medioPago,
      responsableId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una cuota (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cuota eliminada' })
  @ApiResponse({ status: 404, description: 'Cuota no encontrada' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.cuotasService.remove(id);
  }
}
