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
  ApiBody,
  ApiExtraModels,
} from '@nestjs/swagger';
import { MovimientosService } from './movimientos.service';
import {
  CreateMovimientoDto,
  UpdateMovimientoDto,
  FilterMovimientosDto,
} from './dtos';
import { PaginatedResponseDto, PaginationMeta } from '../../common/dtos';
import { MedioPago, EstadoPago } from '../../common/enums';
import { Movimiento } from './entities/movimiento.entity';

@ApiTags('Movimientos')
@ApiExtraModels(PaginatedResponseDto, PaginationMeta, Movimiento)
@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly movimientosService: MovimientosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar movimientos con filtros y paginación',
    description:
      'Retorna movimientos paginados. Por defecto página 1 con 20 elementos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de movimientos',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Movimiento' },
        },
        meta: { $ref: '#/components/schemas/PaginationMeta' },
      },
    },
  })
  async findAll(
    @Query() filters: FilterMovimientosDto,
  ): Promise<PaginatedResponseDto<Movimiento>> {
    return this.movimientosService.findWithFilters(filters);
  }

  @Get('reembolsos-pendientes')
  @ApiOperation({
    summary: 'Obtener reembolsos pendientes agrupados por persona',
  })
  @ApiResponse({ status: 200, description: 'Lista de reembolsos pendientes' })
  async findReembolsosPendientes() {
    return this.movimientosService.findReembolsosPendientes();
  }

  @Get('caja/:cajaId')
  @ApiOperation({ summary: 'Listar movimientos de una caja' })
  @ApiParam({ name: 'cajaId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Movimientos de la caja' })
  async findByCaja(@Param('cajaId', ParseUUIDPipe) cajaId: string) {
    return this.movimientosService.findByCaja(cajaId);
  }

  @Get('responsable/:responsableId')
  @ApiOperation({ summary: 'Listar movimientos de un responsable' })
  @ApiParam({ name: 'responsableId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Movimientos del responsable' })
  async findByResponsable(
    @Param('responsableId', ParseUUIDPipe) responsableId: string,
  ) {
    return this.movimientosService.findByResponsable(responsableId);
  }

  @Get('evento/:eventoId')
  @ApiOperation({ summary: 'Listar movimientos de un evento' })
  @ApiParam({ name: 'eventoId', type: String, format: 'uuid' })
  async findByEvento(@Param('eventoId', ParseUUIDPipe) eventoId: string) {
    return this.movimientosService.findByRelatedEntity('evento', eventoId);
  }

  @Get('campamento/:campamentoId')
  @ApiOperation({ summary: 'Listar movimientos de un campamento' })
  @ApiParam({ name: 'campamentoId', type: String, format: 'uuid' })
  async findByCampamento(
    @Param('campamentoId', ParseUUIDPipe) campamentoId: string,
  ) {
    return this.movimientosService.findByRelatedEntity(
      'campamento',
      campamentoId,
    );
  }

  @Get('inscripcion/:inscripcionId')
  @ApiOperation({ summary: 'Listar movimientos de una inscripción' })
  @ApiParam({ name: 'inscripcionId', type: String, format: 'uuid' })
  async findByInscripcion(
    @Param('inscripcionId', ParseUUIDPipe) inscripcionId: string,
  ) {
    return this.movimientosService.findByRelatedEntity(
      'inscripcion',
      inscripcionId,
    );
  }

  @Get('cuota/:cuotaId')
  @ApiOperation({ summary: 'Listar movimientos de una cuota' })
  @ApiParam({ name: 'cuotaId', type: String, format: 'uuid' })
  async findByCuota(@Param('cuotaId', ParseUUIDPipe) cuotaId: string) {
    return this.movimientosService.findByRelatedEntity('cuota', cuotaId);
  }

  @Get('saldo/:cajaId')
  @ApiOperation({ summary: 'Calcular saldo de una caja' })
  @ApiParam({ name: 'cajaId', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Saldo calculado' })
  async calcularSaldo(@Param('cajaId', ParseUUIDPipe) cajaId: string) {
    const saldo = await this.movimientosService.calcularSaldo(cajaId);
    return { cajaId, saldo };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un movimiento por ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Movimiento encontrado' })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.movimientosService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un movimiento' })
  @ApiResponse({ status: 201, description: 'Movimiento creado' })
  async create(@Body() dto: CreateMovimientoDto) {
    return this.movimientosService.create(dto);
  }

  @Post('gasto-general')
  @ApiOperation({
    summary: 'Registrar un gasto general (no asociado a eventos)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'cajaId',
        'monto',
        'descripcion',
        'responsableId',
        'medioPago',
        'estadoPago',
      ],
      properties: {
        cajaId: { type: 'string', format: 'uuid' },
        monto: { type: 'number', example: 5000 },
        descripcion: { type: 'string', example: 'Compra de materiales' },
        responsableId: { type: 'string', format: 'uuid' },
        medioPago: { type: 'string', enum: ['efectivo', 'transferencia'] },
        estadoPago: { type: 'string', enum: ['pagado', 'pendiente_reembolso'] },
        personaAReembolsarId: { type: 'string', format: 'uuid' },
        requiereComprobante: { type: 'boolean', default: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Gasto general registrado' })
  async registrarGastoGeneral(
    @Body('cajaId', ParseUUIDPipe) cajaId: string,
    @Body('monto') monto: number,
    @Body('descripcion') descripcion: string,
    @Body('responsableId', ParseUUIDPipe) responsableId: string,
    @Body('medioPago') medioPago: MedioPago,
    @Body('estadoPago') estadoPago: EstadoPago,
    @Body('personaAReembolsarId') personaAReembolsarId?: string,
    @Body('requiereComprobante') requiereComprobante?: boolean,
  ) {
    return this.movimientosService.registrarGastoGeneral(
      cajaId,
      monto,
      descripcion,
      responsableId,
      medioPago,
      estadoPago,
      personaAReembolsarId,
      requiereComprobante ?? true,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un movimiento' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Movimiento actualizado' })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMovimientoDto,
  ) {
    return this.movimientosService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un movimiento (soft delete)' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Movimiento eliminado' })
  @ApiResponse({ status: 404, description: 'Movimiento no encontrado' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.movimientosService.remove(id);
  }
}
