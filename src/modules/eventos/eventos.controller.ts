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
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventosService } from './eventos.service';
import { CreateEventoDto } from './dtos/create-evento.dto';
import { CreateProductoDto } from './dtos/create-producto.dto';
import { CreateVentaProductoDto } from './dtos/create-venta-producto.dto';
import { RegistrarGastoEventoDto } from './dtos/registrar-gasto-evento.dto';
import { RegistrarIngresoEventoDto } from './dtos/registrar-ingreso-evento.dto';
import { RegisterVentasLoteDto } from './dtos/register-ventas-lote.dto';
import { UpdateEventoDto } from './dtos/update-evento.dto';

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
  @ApiOperation({
    summary: 'Obtener un evento por ID con resumen financiero',
    description:
      'Retorna el evento con sus productos y el resumen financiero en tiempo real (ingresos, gastos, balance)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Evento encontrado' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventosService.getEventoDetalle(id);
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
  @ApiResponse({
    status: 200,
    description: 'Lista de productos con cantidad vendida acumulada',
  })
  async findProductos(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventosService.findProductosConVentas(id);
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

  @Post(':id/ventas/lote')
  @ApiOperation({
    summary: 'Registrar ventas de múltiples productos para un vendedor',
    description:
      'Permite registrar en una sola request la venta de varios productos por parte de un mismo vendedor',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Ventas registradas' })
  async registrarVentasLote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterVentasLoteDto,
  ) {
    return this.eventosService.registrarVentasLote(id, dto);
  }

  @Get(':id/kpis')
  @ApiOperation({
    summary: 'Obtener KPIs financieros del evento',
    description:
      'Retorna totales discriminados: ingresos, gastos efectivos (PAGADO) y gastos pendientes de reembolso (PENDIENTE_REEMBOLSO)',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'KPIs del evento' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async getKpis(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventosService.getKpisEvento(id);
  }

  @Get(':id/resumen-ventas')
  @ApiOperation({ summary: 'Obtener resumen de ventas del evento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'vendedor',
    required: false,
    description: 'Filtrar vendedores por nombre (búsqueda parcial)',
  })
  @ApiResponse({ status: 200, description: 'Resumen de ventas' })
  async getResumenVentas(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('vendedor') vendedor?: string,
  ) {
    return this.eventosService.getResumenVentas(id, vendedor);
  }

  // ==================== MOVIMIENTOS ====================

  @Get(':id/movimientos')
  @ApiOperation({ summary: 'Listar movimientos financieros de un evento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiQuery({
    name: 'tipo',
    required: false,
    description: 'Filtrar por tipo: ingreso | egreso',
  })
  @ApiQuery({
    name: 'concepto',
    required: false,
    description: 'Filtrar por concepto de movimiento',
  })
  @ApiResponse({ status: 200, description: 'Lista de movimientos del evento' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  async findMovimientos(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tipo') tipo?: string,
    @Query('concepto') concepto?: string,
  ) {
    return this.eventosService.findMovimientosByEvento(id, {
      tipo: tipo as any,
      concepto: concepto as any,
    });
  }

  // ==================== INGRESOS/GASTOS ====================

  @Post(':id/ingresos')
  @ApiOperation({ summary: 'Registrar ingreso de evento de grupo' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Ingreso registrado' })
  async registrarIngreso(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarIngresoEventoDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventosService.registrarIngresoEventoGrupo(
      id,
      dto.monto,
      dto.descripcion,
      dto.responsableId,
      dto.medioPago,
      userId,
    );
  }

  @Post(':id/gastos')
  @ApiOperation({ summary: 'Registrar gasto del evento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Gasto registrado' })
  async registrarGasto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegistrarGastoEventoDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventosService.registrarGastoEvento(
      id,
      dto.monto,
      dto.descripcion,
      dto.responsableId,
      dto.medioPago,
      dto.estadoPago,
      dto.personaAReembolsarId,
      userId,
    );
  }
}
