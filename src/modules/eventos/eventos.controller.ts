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
import { VentasEventoService } from './services/ventas-evento.service';
import { CreateEventoDto } from './dtos/create-evento.dto';
import { CreateProductoDto } from './dtos/create-producto.dto';
import { CreateVentaProductoDto } from './dtos/create-venta-producto.dto';
import { DeleteVentaResponseDto } from './dtos/delete-venta-response.dto';
import { RegistrarGastoEventoDto } from './dtos/registrar-gasto-evento.dto';
import { RegistrarIngresoEventoDto } from './dtos/registrar-ingreso-evento.dto';
import { RegisterVentasLoteDto } from './dtos/register-ventas-lote.dto';
import { UpdateEventoDto } from './dtos/update-evento.dto';
import {
  EVENTOS_ROUTE_SEGMENTS,
  EVENTOS_ROUTES,
  EVENTOS_PARAM_NAMES,
  EVENTOS_QUERY_NAMES,
  EVENTOS_SWAGGER,
} from './constants';

const UUID_PARAM_TYPE = { type: String, format: 'uuid' } as const;

@ApiTags(EVENTOS_SWAGGER.TAG)
@Controller(EVENTOS_ROUTE_SEGMENTS.BASE)
export class EventosController {
  constructor(
    private readonly eventosService: EventosService,
    private readonly ventasEventoService: VentasEventoService,
  ) {}

  // ==================== EVENTOS ====================

  @Get(EVENTOS_ROUTES.ROOT)
  @ApiOperation({ summary: EVENTOS_SWAGGER.EVENTOS.LIST_SUMMARY })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.EVENTOS.LIST_RESPONSE_OK,
  })
  async findAll() {
    return this.eventosService.findAll();
  }

  @Get(EVENTOS_ROUTES.BY_ID)
  @ApiOperation({
    summary: EVENTOS_SWAGGER.EVENTOS.FIND_ONE_SUMMARY,
    description: EVENTOS_SWAGGER.EVENTOS.FIND_ONE_DESCRIPTION,
  })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.EVENTOS.FIND_ONE_RESPONSE_OK,
  })
  @ApiResponse({
    status: 404,
    description: EVENTOS_SWAGGER.EVENTOS.FIND_ONE_RESPONSE_NOT_FOUND,
  })
  async findOne(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
  ) {
    return this.eventosService.getEventoDetalle(eventoId);
  }

  @Post(EVENTOS_ROUTES.ROOT)
  @ApiOperation({ summary: EVENTOS_SWAGGER.EVENTOS.CREATE_SUMMARY })
  @ApiResponse({
    status: 201,
    description: EVENTOS_SWAGGER.EVENTOS.CREATE_RESPONSE_CREATED,
  })
  async create(@Body() dto: CreateEventoDto) {
    return this.eventosService.create(dto);
  }

  @Patch(EVENTOS_ROUTES.BY_ID)
  @ApiOperation({ summary: EVENTOS_SWAGGER.EVENTOS.UPDATE_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.EVENTOS.UPDATE_RESPONSE_OK,
  })
  @ApiResponse({
    status: 404,
    description: EVENTOS_SWAGGER.EVENTOS.UPDATE_RESPONSE_NOT_FOUND,
  })
  async update(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Body() dto: UpdateEventoDto,
  ) {
    return this.eventosService.update(eventoId, dto);
  }

  @Delete(EVENTOS_ROUTES.BY_ID)
  @ApiOperation({ summary: EVENTOS_SWAGGER.EVENTOS.REMOVE_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.EVENTOS.REMOVE_RESPONSE_OK,
  })
  @ApiResponse({
    status: 404,
    description: EVENTOS_SWAGGER.EVENTOS.REMOVE_RESPONSE_NOT_FOUND,
  })
  @ApiResponse({
    status: 409,
    description: EVENTOS_SWAGGER.EVENTOS.REMOVE_RESPONSE_CONFLICT,
  })
  async remove(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
  ) {
    return this.eventosService.remove(eventoId);
  }

  // ==================== PRODUCTOS ====================

  @Get(EVENTOS_ROUTES.PRODUCTOS_BY_EVENTO)
  @ApiOperation({ summary: EVENTOS_SWAGGER.PRODUCTOS.LIST_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.PRODUCTOS.LIST_RESPONSE_OK,
  })
  async findProductos(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
  ) {
    return this.eventosService.findProductosConVentas(eventoId);
  }

  @Post(EVENTOS_ROUTES.PRODUCTOS_BY_EVENTO)
  @ApiOperation({ summary: EVENTOS_SWAGGER.PRODUCTOS.CREATE_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 201,
    description: EVENTOS_SWAGGER.PRODUCTOS.CREATE_RESPONSE_CREATED,
  })
  async createProducto(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Body() dto: CreateProductoDto,
  ) {
    return this.eventosService.createProducto({ ...dto, eventoId });
  }

  @Delete(EVENTOS_ROUTES.PRODUCTO_BY_ID)
  @ApiOperation({ summary: EVENTOS_SWAGGER.PRODUCTOS.REMOVE_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.PRODUCTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.PRODUCTOS.REMOVE_RESPONSE_OK,
  })
  async removeProducto(
    @Param(EVENTOS_PARAM_NAMES.PRODUCTO_ID, ParseUUIDPipe) productoId: string,
  ) {
    return this.eventosService.removeProducto(productoId);
  }

  // ==================== VENTAS ====================

  @Get(EVENTOS_ROUTES.VENTAS_BY_EVENTO)
  @ApiOperation({ summary: EVENTOS_SWAGGER.VENTAS.LIST_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiQuery({
    name: EVENTOS_QUERY_NAMES.VENDEDOR,
    required: false,
    description: EVENTOS_SWAGGER.VENTAS.QUERY_VENDEDOR_DESCRIPTION,
  })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.VENTAS.LIST_RESPONSE_OK,
  })
  async findVentas(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Query(EVENTOS_QUERY_NAMES.VENDEDOR) vendedor?: string,
  ) {
    return this.eventosService.findVentasByEvento(eventoId, vendedor);
  }

  @Post(EVENTOS_ROUTES.VENTAS_BY_EVENTO)
  @ApiOperation({ summary: EVENTOS_SWAGGER.VENTAS.REGISTRAR_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 201,
    description: EVENTOS_SWAGGER.VENTAS.REGISTRAR_RESPONSE_CREATED,
  })
  async registrarVenta(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Body() dto: CreateVentaProductoDto,
  ) {
    return this.eventosService.registrarVenta({ ...dto, eventoId });
  }

  @Post(EVENTOS_ROUTES.VENTAS_LOTE_BY_EVENTO)
  @ApiOperation({
    summary: EVENTOS_SWAGGER.VENTAS.REGISTRAR_LOTE_SUMMARY,
    description: EVENTOS_SWAGGER.VENTAS.REGISTRAR_LOTE_DESCRIPTION,
  })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 201,
    description: EVENTOS_SWAGGER.VENTAS.REGISTRAR_LOTE_RESPONSE_CREATED,
  })
  async registrarVentasLote(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Body() dto: RegisterVentasLoteDto,
  ) {
    return this.eventosService.registrarVentasLote(eventoId, dto);
  }

  @Delete(EVENTOS_ROUTES.VENTA_BY_ID)
  @ApiOperation({
    summary: EVENTOS_SWAGGER.VENTAS.DELETE_SUMMARY,
    description: EVENTOS_SWAGGER.VENTAS.DELETE_DESCRIPTION,
  })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.VENTA_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.VENTAS.DELETE_RESPONSE_OK,
    type: DeleteVentaResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: EVENTOS_SWAGGER.VENTAS.DELETE_RESPONSE_BAD_REQUEST,
  })
  @ApiResponse({
    status: 404,
    description: EVENTOS_SWAGGER.VENTAS.DELETE_RESPONSE_NOT_FOUND,
  })
  @ApiResponse({
    status: 409,
    description: EVENTOS_SWAGGER.VENTAS.DELETE_RESPONSE_CONFLICT,
  })
  async deleteVenta(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Param(EVENTOS_PARAM_NAMES.VENTA_ID, ParseUUIDPipe) ventaId: string,
  ): Promise<DeleteVentaResponseDto> {
    return this.ventasEventoService.deleteVenta(eventoId, ventaId);
  }

  @Get(EVENTOS_ROUTES.KPIS_BY_EVENTO)
  @ApiOperation({
    summary: EVENTOS_SWAGGER.KPIS.GET_SUMMARY,
    description: EVENTOS_SWAGGER.KPIS.GET_DESCRIPTION,
  })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.KPIS.GET_RESPONSE_OK,
  })
  @ApiResponse({
    status: 404,
    description: EVENTOS_SWAGGER.KPIS.GET_RESPONSE_NOT_FOUND,
  })
  async getKpis(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
  ) {
    return this.eventosService.getKpisEvento(eventoId);
  }

  @Get(EVENTOS_ROUTES.RESUMEN_VENTAS_BY_EVENTO)
  @ApiOperation({ summary: EVENTOS_SWAGGER.RESUMEN_VENTAS.GET_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiQuery({
    name: EVENTOS_QUERY_NAMES.VENDEDOR,
    required: false,
    description: EVENTOS_SWAGGER.RESUMEN_VENTAS.QUERY_VENDEDOR_DESCRIPTION,
  })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.RESUMEN_VENTAS.GET_RESPONSE_OK,
  })
  async getResumenVentas(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Query(EVENTOS_QUERY_NAMES.VENDEDOR) vendedor?: string,
  ) {
    return this.eventosService.getResumenVentas(eventoId, vendedor);
  }

  // ==================== MOVIMIENTOS ====================

  @Get(EVENTOS_ROUTES.MOVIMIENTOS_BY_EVENTO)
  @ApiOperation({ summary: EVENTOS_SWAGGER.MOVIMIENTOS.LIST_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiQuery({
    name: EVENTOS_QUERY_NAMES.TIPO,
    required: false,
    description: EVENTOS_SWAGGER.MOVIMIENTOS.QUERY_TIPO_DESCRIPTION,
  })
  @ApiQuery({
    name: EVENTOS_QUERY_NAMES.CONCEPTO,
    required: false,
    description: EVENTOS_SWAGGER.MOVIMIENTOS.QUERY_CONCEPTO_DESCRIPTION,
  })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.MOVIMIENTOS.LIST_RESPONSE_OK,
  })
  @ApiResponse({
    status: 404,
    description: EVENTOS_SWAGGER.MOVIMIENTOS.LIST_RESPONSE_NOT_FOUND,
  })
  async findMovimientos(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Query(EVENTOS_QUERY_NAMES.TIPO) tipo?: string,
    @Query(EVENTOS_QUERY_NAMES.CONCEPTO) concepto?: string,
  ) {
    return this.eventosService.findMovimientosByEvento(eventoId, {
      tipo: tipo as any,
      concepto: concepto as any,
    });
  }

  // ==================== INGRESOS/GASTOS ====================

  @Post(EVENTOS_ROUTES.INGRESOS_BY_EVENTO)
  @ApiOperation({ summary: EVENTOS_SWAGGER.INGRESOS.REGISTRAR_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.INGRESOS.REGISTRAR_RESPONSE_OK,
  })
  async registrarIngreso(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Body() dto: RegistrarIngresoEventoDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventosService.registrarIngresoEventoGrupo(
      eventoId,
      dto.monto,
      dto.descripcion,
      dto.responsableId,
      dto.medioPago,
      userId,
    );
  }

  @Post(EVENTOS_ROUTES.GASTOS_BY_EVENTO)
  @ApiOperation({ summary: EVENTOS_SWAGGER.GASTOS.REGISTRAR_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.GASTOS.REGISTRAR_RESPONSE_OK,
  })
  async registrarGasto(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Body() dto: RegistrarGastoEventoDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventosService.registrarGastoEvento(
      eventoId,
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
