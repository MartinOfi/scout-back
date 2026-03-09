import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { EventosService } from './eventos.service';
import { CreateEventoDto } from './dtos/create-evento.dto';
import { UpdateEventoDto } from './dtos/update-evento.dto';
import { CreateProductoDto } from './dtos/create-producto.dto';
import { CreateVentaProductoDto } from './dtos/create-venta-producto.dto';
import { MedioPago, EstadoPago } from '../../common/enums';

@ApiTags('Eventos')
@Controller('eventos')
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  // ==================== EVENTOS ====================

  @Get()
  @ApiOperation({ summary: 'Listar todos los eventos' })
  @ApiResponse({ status: 200, description: 'Lista de eventos' })
  async findAll() {
    return this.eventosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un evento por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Evento encontrado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventosService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un evento' })
  @ApiResponse({ status: 201, description: 'Evento creado' })
  async create(@Body() dto: CreateEventoDto) {
    return this.eventosService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un evento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Evento actualizado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventoDto,
  ) {
    return this.eventosService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un evento (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Evento eliminado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventosService.remove(id);
  }

  // ==================== PRODUCTOS ====================

  @Get(':id/productos')
  @ApiOperation({ summary: 'Listar productos de un evento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Lista de productos' })
  async findProductos(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventosService.findProductosByEvento(id);
  }

  @Post(':id/productos')
  @ApiOperation({ summary: 'Crear producto para un evento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Producto creado' })
  async createProducto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProductoDto,
  ) {
    return this.eventosService.createProducto({ ...dto, eventoId: id });
  }

  @Delete('productos/:productoId')
  @ApiOperation({ summary: 'Eliminar un producto' })
  @ApiParam({ name: 'productoId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Producto eliminado' })
  async removeProducto(@Param('productoId', ParseUUIDPipe) productoId: string) {
    return this.eventosService.removeProducto(productoId);
  }

  // ==================== VENTAS ====================

  @Get(':id/ventas')
  @ApiOperation({ summary: 'Listar ventas de un evento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Lista de ventas' })
  async findVentas(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventosService.findVentasByEvento(id);
  }

  @Post(':id/ventas')
  @ApiOperation({ summary: 'Registrar una venta' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Venta registrada' })
  async registrarVenta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVentaProductoDto,
  ) {
    return this.eventosService.registrarVenta({ ...dto, eventoId: id });
  }

  @Get(':id/resumen-ventas')
  @ApiOperation({ summary: 'Obtener resumen de ventas del evento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Resumen de ventas' })
  async getResumenVentas(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventosService.getResumenVentas(id);
  }

  // ==================== CIERRE ====================

  @Post(':id/cerrar')
  @ApiOperation({ summary: 'Cerrar evento de venta y distribuir ganancias' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['medioPago'],
      properties: {
        medioPago: { type: 'string', enum: ['efectivo', 'transferencia'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Evento cerrado' })
  async cerrarEvento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('medioPago') medioPago: MedioPago,
  ) {
    return this.eventosService.cerrarEventoVenta(id, medioPago);
  }

  // ==================== INGRESOS/GASTOS ====================

  @Post(':id/ingresos')
  @ApiOperation({ summary: 'Registrar ingreso de evento de grupo' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['monto', 'descripcion', 'responsableId', 'medioPago'],
      properties: {
        monto: { type: 'number', example: 10000 },
        descripcion: { type: 'string', example: 'Venta de entradas' },
        responsableId: { type: 'string', format: 'uuid' },
        medioPago: { type: 'string', enum: ['efectivo', 'transferencia'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Ingreso registrado' })
  async registrarIngreso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('monto') monto: number,
    @Body('descripcion') descripcion: string,
    @Body('responsableId', ParseUUIDPipe) responsableId: string,
    @Body('medioPago') medioPago: MedioPago,
  ) {
    return this.eventosService.registrarIngresoEventoGrupo(
      id,
      monto,
      descripcion,
      responsableId,
      medioPago,
    );
  }

  @Post(':id/gastos')
  @ApiOperation({ summary: 'Registrar gasto del evento' })
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
        descripcion: { type: 'string', example: 'Compra de materiales' },
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
    return this.eventosService.registrarGastoEvento(
      id,
      monto,
      descripcion,
      responsableId,
      medioPago,
      estadoPago,
      personaAReembolsarId,
    );
  }
}
