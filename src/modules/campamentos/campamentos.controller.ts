import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { CampamentosService } from './campamentos.service';
import { CreateCampamentoDto } from './dtos/create-campamento.dto';
import { UpdateCampamentoDto } from './dtos/update-campamento.dto';
import { AddParticipanteDto } from './dtos/add-participante.dto';
import { PagarCampamentoDto } from './dtos/pagar-campamento.dto';
import {
  MedioPago,
  EstadoPago,
  FiltroMovimientosCampamento,
} from '../../common/enums';
import { CampamentoDetalleDto } from './dtos/campamento-detalle.dto';
import { ResultadoPagoDto } from '../pagos/dtos/resultado-pago.dto';

@ApiTags('Campamentos')
@Controller('campamentos')
export class CampamentosController {
  constructor(private readonly campamentosService: CampamentosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los campamentos' })
  @ApiResponse({ status: 200, description: 'Lista de campamentos' })
  async findAll() {
    return this.campamentosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un campamento por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Campamento encontrado' })
  @ApiResponse({ status: 404, description: 'Campamento no encontrado' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.campamentosService.findOne(id);
  }

  @Get(':id/resumen-financiero')
  @ApiOperation({ summary: 'Obtener resumen financiero del campamento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Resumen financiero' })
  async getResumenFinanciero(@Param('id', ParseUUIDPipe) id: string) {
    return this.campamentosService.getResumenFinanciero(id);
  }

  @Get(':id/pagos-por-participante')
  @ApiOperation({ summary: 'Obtener seguimiento de pagos por participante' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Lista de pagos por participante',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          participanteId: { type: 'string', format: 'uuid' },
          participanteNombre: { type: 'string' },
          costoPorPersona: { type: 'number' },
          totalPagado: { type: 'number' },
          saldoPendiente: { type: 'number' },
          pagos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fecha: { type: 'string', format: 'date-time' },
                monto: { type: 'number' },
                medioPago: { type: 'string' },
              },
            },
          },
        },
      },
    },
  })
  async getPagosPorParticipante(@Param('id', ParseUUIDPipe) id: string) {
    return this.campamentosService.getPagosPorParticipante(id);
  }

  @Get(':id/detalle')
  @ApiOperation({
    summary: 'Obtener vista completa del campamento',
    description:
      'Retorna participantes con estado de pago, movimientos filtrados y KPIs financieros',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'filtroMovimientos',
    enum: FiltroMovimientosCampamento,
    required: false,
    description:
      'Filtro de movimientos: todos (default), ingresos (pagos recibidos), gastos (compras reales, sin uso de saldo personal)',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle completo del campamento',
    type: CampamentoDetalleDto,
  })
  @ApiResponse({ status: 404, description: 'Campamento no encontrado' })
  async getDetalle(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('filtroMovimientos') filtro?: FiltroMovimientosCampamento,
  ): Promise<CampamentoDetalleDto> {
    return this.campamentosService.getDetalle(id, filtro);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un campamento' })
  @ApiResponse({ status: 201, description: 'Campamento creado' })
  async create(@Body() dto: CreateCampamentoDto) {
    return this.campamentosService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un campamento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Campamento actualizado' })
  @ApiResponse({ status: 404, description: 'Campamento no encontrado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampamentoDto,
  ) {
    return this.campamentosService.update(id, dto);
  }

  @Post(':id/participantes')
  @ApiOperation({ summary: 'Agregar participante al campamento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Participante agregado' })
  @ApiResponse({ status: 400, description: 'Participante ya inscrito' })
  async addParticipante(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddParticipanteDto,
  ) {
    return this.campamentosService.addParticipante(id, dto);
  }

  @Delete(':id/participantes/:personaId')
  @ApiOperation({ summary: 'Remover participante del campamento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiParam({ name: 'personaId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Participante removido' })
  async removeParticipante(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('personaId', ParseUUIDPipe) personaId: string,
  ) {
    return this.campamentosService.removeParticipante(id, personaId);
  }

  @Post(':id/pagos/:personaId')
  @ApiOperation({
    summary: 'Registrar pago de participante',
    description:
      'Registra un pago de campamento con soporte para pago mixto (efectivo/transferencia + saldo personal)',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'ID del campamento',
  })
  @ApiParam({
    name: 'personaId',
    type: String,
    format: 'uuid',
    description: 'ID del participante',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago registrado exitosamente',
    type: ResultadoPagoDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o saldo insuficiente',
  })
  @ApiResponse({
    status: 404,
    description: 'Campamento o persona no encontrado',
  })
  async registrarPago(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('personaId', ParseUUIDPipe) personaId: string,
    @Body() dto: PagarCampamentoDto,
  ): Promise<ResultadoPagoDto> {
    return this.campamentosService.registrarPago(id, personaId, dto);
  }

  @Delete(':id/pagos/:movimientoId')
  @ApiOperation({
    summary: 'Eliminar pago de campamento',
    description:
      'Elimina un pago de campamento. Si el pago usó saldo personal, también revierte el movimiento de egreso asociado.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'ID del campamento',
  })
  @ApiParam({
    name: 'movimientoId',
    type: String,
    format: 'uuid',
    description: 'ID del movimiento de pago (INGRESO) a eliminar',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago eliminado exitosamente',
    schema: {
      type: 'object',
      properties: {
        movimientosEliminados: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
          description: 'IDs de los movimientos eliminados',
        },
        montoRevertido: {
          type: 'number',
          description: 'Monto total revertido',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Campamento o movimiento no encontrado',
  })
  async eliminarPago(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('movimientoId', ParseUUIDPipe) movimientoId: string,
  ): Promise<{ movimientosEliminados: string[]; montoRevertido: number }> {
    return this.campamentosService.eliminarPagoCampamento(id, movimientoId);
  }

  @Post(':id/gastos')
  @ApiOperation({ summary: 'Registrar gasto del campamento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'monto',
        'descripcion',
        'responsableId',
        'medioPago',
        'estadoPago',
      ],
      properties: {
        monto: { type: 'number', example: 5000 },
        descripcion: { type: 'string', example: 'Compra de alimentos' },
        responsableId: { type: 'string', format: 'uuid' },
        medioPago: { type: 'string', enum: ['efectivo', 'transferencia'] },
        estadoPago: { type: 'string', enum: ['pagado', 'pendiente_reembolso'] },
        personaAReembolsarId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Gasto registrado' })
  async registrarGasto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('monto') monto: number,
    @Body('descripcion') descripcion: string,
    @Body('responsableId', ParseUUIDPipe) responsableId: string,
    @Body('medioPago') medioPago: MedioPago,
    @Body('estadoPago') estadoPago: EstadoPago,
    @Body('personaAReembolsarId') personaAReembolsarId?: string,
  ) {
    return this.campamentosService.registrarGasto(
      id,
      monto,
      descripcion,
      responsableId,
      medioPago,
      estadoPago,
      personaAReembolsarId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un campamento (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Campamento eliminado' })
  @ApiResponse({ status: 404, description: 'Campamento no encontrado' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.campamentosService.remove(id);
  }
}
