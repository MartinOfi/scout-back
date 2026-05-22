import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EntregasEventoService } from './services/entregas-evento.service';
import {
  CreateEntregaDto,
  EntregaResponseDto,
  StockEntregaResponseDto,
} from './dtos';
import {
  ENTREGAS_CONTROLLER_PATH,
  ENTREGAS_ROUTES,
  EVENTOS_PARAM_NAMES,
  EVENTOS_QUERY_NAMES,
  EVENTOS_SWAGGER,
} from './constants';

const UUID_PARAM_TYPE = { type: String, format: 'uuid' } as const;

/**
 * EntregasController - delivery tracking for sale events.
 *
 * Route layout (declared in this exact order):
 *   POST   /eventos/:eventoId/entregas
 *   GET    /eventos/:eventoId/entregas?vendedor=...
 *   GET    /eventos/:eventoId/entregas/stock-disponible?vendedor=...
 *   GET    /eventos/:eventoId/entregas/:entregaId
 *   DELETE /eventos/:eventoId/entregas/:entregaId
 *
 * `stock-disponible` MUST be declared before `:entregaId` so the literal
 * path is not shadowed by the dynamic parameter.
 */
@ApiTags(EVENTOS_SWAGGER.ENTREGAS.TAG)
@Controller(ENTREGAS_CONTROLLER_PATH)
export class EntregasController {
  constructor(private readonly entregasEventoService: EntregasEventoService) {}

  @Post(ENTREGAS_ROUTES.ROOT)
  @ApiOperation({
    summary: EVENTOS_SWAGGER.ENTREGAS.CREATE_SUMMARY,
    description: EVENTOS_SWAGGER.ENTREGAS.CREATE_DESCRIPTION,
  })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 201,
    description: EVENTOS_SWAGGER.ENTREGAS.CREATE_RESPONSE_CREATED,
    type: EntregaResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: EVENTOS_SWAGGER.ENTREGAS.CREATE_RESPONSE_BAD_REQUEST,
  })
  async crearEntrega(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Body() dto: CreateEntregaDto,
    // Auth is not yet implemented project-wide, so this resolves to undefined
    // until JWT lands. The service stores `registradoPorId` as null in that
    // case — see EntregasEventoService.crearEntrega.
    @CurrentUser('id') userId: string | undefined,
  ): Promise<EntregaResponseDto> {
    return this.entregasEventoService.crearEntrega(eventoId, dto, userId);
  }

  @Get(ENTREGAS_ROUTES.ROOT)
  @ApiOperation({ summary: EVENTOS_SWAGGER.ENTREGAS.LIST_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiQuery({
    name: EVENTOS_QUERY_NAMES.VENDEDOR,
    required: false,
    description: EVENTOS_SWAGGER.ENTREGAS.QUERY_VENDEDOR_DESCRIPTION,
  })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.ENTREGAS.LIST_RESPONSE_OK,
    type: [EntregaResponseDto],
  })
  async findByEvento(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Query(EVENTOS_QUERY_NAMES.VENDEDOR) vendedor?: string,
  ): Promise<EntregaResponseDto[]> {
    return this.entregasEventoService.findByEvento(eventoId, vendedor);
  }

  @Get(ENTREGAS_ROUTES.STOCK_DISPONIBLE)
  @ApiOperation({
    summary: EVENTOS_SWAGGER.ENTREGAS.STOCK_SUMMARY,
    description: EVENTOS_SWAGGER.ENTREGAS.STOCK_DESCRIPTION,
  })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiQuery({
    name: EVENTOS_QUERY_NAMES.VENDEDOR,
    required: false,
    description: EVENTOS_SWAGGER.ENTREGAS.STOCK_QUERY_VENDEDOR_DESCRIPTION,
  })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.ENTREGAS.STOCK_RESPONSE_OK,
    type: [StockEntregaResponseDto],
  })
  async getStockDisponible(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Query(EVENTOS_QUERY_NAMES.VENDEDOR) vendedor?: string,
  ): Promise<StockEntregaResponseDto[]> {
    return this.entregasEventoService.getStockDisponible(eventoId, vendedor);
  }

  @Get(ENTREGAS_ROUTES.BY_ID)
  @ApiOperation({ summary: EVENTOS_SWAGGER.ENTREGAS.FIND_ONE_SUMMARY })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.ENTREGA_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 200,
    description: EVENTOS_SWAGGER.ENTREGAS.FIND_ONE_RESPONSE_OK,
    type: EntregaResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: EVENTOS_SWAGGER.ENTREGAS.FIND_ONE_RESPONSE_NOT_FOUND,
  })
  async findOne(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Param(EVENTOS_PARAM_NAMES.ENTREGA_ID, ParseUUIDPipe) entregaId: string,
  ): Promise<EntregaResponseDto> {
    return this.entregasEventoService.findOne(eventoId, entregaId);
  }

  @Delete(ENTREGAS_ROUTES.BY_ID)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: EVENTOS_SWAGGER.ENTREGAS.DELETE_SUMMARY,
    description: EVENTOS_SWAGGER.ENTREGAS.DELETE_DESCRIPTION,
  })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.EVENTO_ID, ...UUID_PARAM_TYPE })
  @ApiParam({ name: EVENTOS_PARAM_NAMES.ENTREGA_ID, ...UUID_PARAM_TYPE })
  @ApiResponse({
    status: 204,
    description: EVENTOS_SWAGGER.ENTREGAS.DELETE_RESPONSE_OK,
  })
  @ApiResponse({
    status: 400,
    description: EVENTOS_SWAGGER.ENTREGAS.DELETE_RESPONSE_BAD_REQUEST,
  })
  @ApiResponse({
    status: 404,
    description: EVENTOS_SWAGGER.ENTREGAS.DELETE_RESPONSE_NOT_FOUND,
  })
  @ApiResponse({
    status: 409,
    description: EVENTOS_SWAGGER.ENTREGAS.DELETE_RESPONSE_CONFLICT,
  })
  async deleteEntrega(
    @Param(EVENTOS_PARAM_NAMES.EVENTO_ID, ParseUUIDPipe) eventoId: string,
    @Param(EVENTOS_PARAM_NAMES.ENTREGA_ID, ParseUUIDPipe) entregaId: string,
  ): Promise<void> {
    await this.entregasEventoService.deleteEntrega(eventoId, entregaId);
  }
}
