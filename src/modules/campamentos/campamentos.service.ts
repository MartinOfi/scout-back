import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Campamento } from './entities/campamento.entity';
import { CreateCampamentoDto } from './dtos/create-campamento.dto';
import { UpdateCampamentoDto } from './dtos/update-campamento.dto';
import { AddParticipanteDto } from './dtos/add-participante.dto';
import { PagarCampamentoDto } from './dtos/pagar-campamento.dto';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { PagosService } from '../pagos/pagos.service';
import { ResultadoPagoDto } from '../pagos/dtos/resultado-pago.dto';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
  EstadoPagoCampamento,
} from '../../common/enums';
import {
  CampamentoDetalleDto,
  ParticipantePagoDto,
  PagoParticipanteDto,
  MovimientoCampamentoDto,
  CampamentoKpisDto,
} from './dtos/campamento-detalle.dto';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { Persona } from '../personas/entities/persona.entity';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';

@Injectable()
export class CampamentosService {
  constructor(
    @InjectRepository(Campamento)
    private readonly campamentoRepository: Repository<Campamento>,
    @Inject(forwardRef(() => PersonasService))
    private readonly personasService: PersonasService,
    @Inject(forwardRef(() => CajasService))
    private readonly cajasService: CajasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
    @Inject(forwardRef(() => PagosService))
    private readonly pagosService: PagosService,
    private readonly dataSource: DataSource,
    private readonly deletionValidator: DeletionValidatorService,
  ) {}

  async findAll(): Promise<Campamento[]> {
    return this.campamentoRepository.find({
      relations: ['participantes'],
      order: { fechaInicio: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Campamento> {
    const campamento = await this.campamentoRepository.findOne({
      where: { id },
      relations: ['participantes'],
    });

    if (!campamento) {
      throw new NotFoundException(`Campamento con ID ${id} no encontrado`);
    }

    return campamento;
  }

  async create(dto: CreateCampamentoDto): Promise<Campamento> {
    const campamento = this.campamentoRepository.create({
      ...dto,
      participantes: [],
    });

    return this.campamentoRepository.save(campamento);
  }

  async update(id: string, dto: UpdateCampamentoDto): Promise<Campamento> {
    const campamento = await this.findOne(id);
    Object.assign(campamento, dto);
    return this.campamentoRepository.save(campamento);
  }

  async addParticipante(
    id: string,
    dto: AddParticipanteDto,
  ): Promise<Campamento> {
    const campamento = await this.findOne(id);
    const persona = await this.personasService.findOne(dto.personaId);

    // Verificar que no esté ya agregado
    const yaEstaAgregado = campamento.participantes.some(
      (p) => p.id === dto.personaId,
    );

    if (yaEstaAgregado) {
      throw new BadRequestException(
        'Esta persona ya está inscrita en el campamento',
      );
    }

    campamento.participantes.push(persona);
    return this.campamentoRepository.save(campamento);
  }

  async removeParticipante(id: string, personaId: string): Promise<Campamento> {
    const campamento = await this.findOne(id);

    campamento.participantes = campamento.participantes.filter(
      (p) => p.id !== personaId,
    );

    return this.campamentoRepository.save(campamento);
  }

  /**
   * Registra pago de campamento con soporte para pago mixto
   * (efectivo/transferencia + saldo personal)
   */
  async registrarPago(
    campamentoId: string,
    personaId: string,
    dto: PagarCampamentoDto,
  ): Promise<ResultadoPagoDto> {
    const campamento = await this.findOne(campamentoId);
    await this.personasService.findOne(personaId);

    const {
      montoPagado,
      montoConSaldoPersonal = 0,
      medioPago,
      descripcion,
    } = dto;
    const montoTotal = montoPagado + montoConSaldoPersonal;

    if (montoTotal <= 0) {
      throw new BadRequestException(
        'El monto total (montoPagado + montoConSaldoPersonal) debe ser mayor a 0',
      );
    }

    if (montoPagado > 0 && !medioPago) {
      throw new BadRequestException(
        'Se requiere medioPago cuando montoPagado > 0',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      return this.pagosService.ejecutarPagoConManager(manager, {
        personaId,
        montoTotal,
        montoConSaldoPersonal,
        medioPago,
        concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
        campamentoId,
        descripcion: descripcion ?? `Pago campamento "${campamento.nombre}"`,
      });
    });
  }

  async registrarGasto(
    campamentoId: string,
    monto: number,
    descripcion: string,
    responsableId: string,
    medioPago: MedioPago,
    estadoPago: EstadoPago,
    personaAReembolsarId?: string,
  ): Promise<void> {
    const campamento = await this.findOne(campamentoId);
    await this.personasService.findOne(responsableId);

    const cajaGrupo = await this.cajasService.findCajaGrupo();

    await this.movimientosService.create({
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.EGRESO,
      monto,
      concepto: ConceptoMovimiento.CAMPAMENTO_GASTO,
      descripcion: `${descripcion} - Campamento "${campamento.nombre}"`,
      responsableId,
      medioPago,
      estadoPago,
      personaAReembolsarId,
      campamentoId,
    });
  }

  async getResumenFinanciero(campamentoId: string): Promise<{
    totalEsperado: number;
    totalRecaudado: number;
    totalGastado: number;
    saldo: number;
    participantes: number;
  }> {
    const campamento = await this.findOne(campamentoId);
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'campamento',
      campamentoId,
    );

    const totalRecaudado = movimientos
      .filter((m) => m.tipo === TipoMovimiento.INGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const totalGastado = movimientos
      .filter((m) => m.tipo === TipoMovimiento.EGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    return {
      totalEsperado:
        campamento.participantes.length * Number(campamento.costoPorPersona),
      totalRecaudado,
      totalGastado,
      saldo: totalRecaudado - totalGastado,
      participantes: campamento.participantes.length,
    };
  }

  /**
   * Obtiene el seguimiento de pagos por participante
   * PRD F4: Control de pagos por participante en campamentos
   */
  async getPagosPorParticipante(campamentoId: string): Promise<
    {
      participanteId: string;
      participanteNombre: string;
      costoPorPersona: number;
      totalPagado: number;
      saldoPendiente: number;
      pagos: { fecha: Date; monto: number; medioPago: string }[];
    }[]
  > {
    const campamento = await this.findOne(campamentoId);
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'campamento',
      campamentoId,
    );

    // Filtrar solo pagos (ingresos con concepto CAMPAMENTO_PAGO)
    const pagos = movimientos.filter(
      (m) =>
        m.tipo === TipoMovimiento.INGRESO &&
        m.concepto === ConceptoMovimiento.CAMPAMENTO_PAGO,
    );

    // Agrupar por responsableId (participante que pagó)
    const pagosPorParticipante = new Map<
      string,
      {
        totalPagado: number;
        pagos: { fecha: Date; monto: number; medioPago: string }[];
      }
    >();

    for (const pago of pagos) {
      const current = pagosPorParticipante.get(pago.responsableId) || {
        totalPagado: 0,
        pagos: [],
      };

      current.totalPagado += Number(pago.monto);
      current.pagos.push({
        fecha: pago.fecha,
        monto: Number(pago.monto),
        medioPago: pago.medioPago,
      });

      pagosPorParticipante.set(pago.responsableId, current);
    }

    const costoPorPersona = Number(campamento.costoPorPersona);

    // Construir respuesta con todos los participantes
    return campamento.participantes.map((participante) => {
      const datosPago = pagosPorParticipante.get(participante.id) || {
        totalPagado: 0,
        pagos: [],
      };

      return {
        participanteId: participante.id,
        participanteNombre: participante.nombre,
        costoPorPersona,
        totalPagado: datosPago.totalPagado,
        saldoPendiente: costoPorPersona - datosPago.totalPagado,
        pagos: datosPago.pagos.sort(
          (a, b) => b.fecha.getTime() - a.fecha.getTime(),
        ),
      };
    });
  }

  /**
   * Get complete campamento detail including participants, payments, and KPIs
   * Consolidates getResumenFinanciero and getPagosPorParticipante in a single call
   */
  async getDetalle(campamentoId: string): Promise<CampamentoDetalleDto> {
    // 1. Load campamento with participants
    const campamento = await this.findOne(campamentoId);

    // 2. Load all movements for this campamento
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'campamento',
      campamentoId,
    );

    // 3. Separate payments (INGRESO) from expenses (EGRESO)
    const pagos = movimientos.filter(
      (m) =>
        m.tipo === TipoMovimiento.INGRESO &&
        m.concepto === ConceptoMovimiento.CAMPAMENTO_PAGO,
    );

    // 4. Build payments map by responsableId (participant)
    const pagosPorParticipante = this.buildPagosPorParticipante(pagos);

    // 5. Build participant DTOs with payment status
    const costoPorPersona = Number(campamento.costoPorPersona);
    const participantesDto = this.buildParticipantesDto(
      campamento.participantes,
      pagosPorParticipante,
      costoPorPersona,
    );

    // 6. Calculate KPIs
    const kpis = this.calculateKpis(
      participantesDto,
      movimientos,
      costoPorPersona,
    );

    // 7. Build movimientos DTO
    const movimientosDto = this.buildMovimientosDto(movimientos);

    // 8. Assemble response
    return {
      campamento: {
        id: campamento.id,
        nombre: campamento.nombre,
        fechaInicio: campamento.fechaInicio,
        fechaFin: campamento.fechaFin,
        costoPorPersona,
        cuotasBase: campamento.cuotasBase,
        descripcion: campamento.descripcion,
      },
      participantes: participantesDto,
      movimientos: movimientosDto,
      kpis,
    };
  }

  /**
   * Build payments map grouped by participant ID
   */
  private buildPagosPorParticipante(
    pagos: Movimiento[],
  ): Map<string, { totalPagado: number; pagos: PagoParticipanteDto[] }> {
    const result = new Map<
      string,
      { totalPagado: number; pagos: PagoParticipanteDto[] }
    >();

    for (const pago of pagos) {
      const current = result.get(pago.responsableId) ?? {
        totalPagado: 0,
        pagos: [],
      };

      const updatedPagos: PagoParticipanteDto[] = [
        ...current.pagos,
        {
          movimientoId: pago.id,
          fecha: pago.fecha,
          monto: Number(pago.monto),
          medioPago: pago.medioPago,
        },
      ];

      result.set(pago.responsableId, {
        totalPagado: current.totalPagado + Number(pago.monto),
        pagos: updatedPagos,
      });
    }

    return result;
  }

  /**
   * Build participant DTOs with payment status
   */
  private buildParticipantesDto(
    participantes: Persona[],
    pagosPorParticipante: Map<
      string,
      { totalPagado: number; pagos: PagoParticipanteDto[] }
    >,
    costoPorPersona: number,
  ): ParticipantePagoDto[] {
    return participantes.map((participante) => {
      const datosPago = pagosPorParticipante.get(participante.id) ?? {
        totalPagado: 0,
        pagos: [],
      };

      const saldoPendiente = costoPorPersona - datosPago.totalPagado;
      const estadoPago = this.determineEstadoPago(
        datosPago.totalPagado,
        costoPorPersona,
      );

      // Get rama from persona (only for Protagonista/Educador)
      const rama =
        'rama' in participante
          ? (participante as { rama: unknown }).rama
          : null;

      return {
        id: participante.id,
        nombre: participante.nombre,
        tipo: participante.tipo,
        rama: rama as ParticipantePagoDto['rama'],
        costoPorPersona,
        totalPagado: datosPago.totalPagado,
        saldoPendiente,
        estadoPago,
        pagos: datosPago.pagos.sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
        ),
      };
    });
  }

  /**
   * Determine payment status based on amount paid vs cost
   */
  private determineEstadoPago(
    totalPagado: number,
    costoPorPersona: number,
  ): EstadoPagoCampamento {
    if (totalPagado === 0) {
      return EstadoPagoCampamento.PENDIENTE;
    }
    if (totalPagado >= costoPorPersona) {
      return EstadoPagoCampamento.PAGADO;
    }
    return EstadoPagoCampamento.PARCIAL;
  }

  /**
   * Calculate all KPIs for the campamento
   */
  private calculateKpis(
    participantes: ParticipantePagoDto[],
    movimientos: Movimiento[],
    costoPorPersona: number,
  ): CampamentoKpisDto {
    const cantidadParticipantes = participantes.length;
    const totalARecaudar = costoPorPersona * cantidadParticipantes;

    const totalRecaudado = movimientos
      .filter((m) => m.tipo === TipoMovimiento.INGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const totalGastado = movimientos
      .filter((m) => m.tipo === TipoMovimiento.EGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const participantesPagadosCompleto = participantes.filter(
      (p) => p.estadoPago === EstadoPagoCampamento.PAGADO,
    ).length;

    const participantesPagadosParcial = participantes.filter(
      (p) => p.estadoPago === EstadoPagoCampamento.PARCIAL,
    ).length;

    const participantesPendientes = participantes.filter(
      (p) => p.estadoPago === EstadoPagoCampamento.PENDIENTE,
    ).length;

    return {
      totalARecaudar,
      totalRecaudado,
      totalGastado,
      balance: totalRecaudado - totalGastado,
      deudaTotal: totalARecaudar - totalRecaudado,
      cantidadParticipantes,
      participantesPagadosCompleto,
      participantesPagadosParcial,
      participantesPendientes,
    };
  }

  /**
   * Build movement DTOs for response
   */
  private buildMovimientosDto(
    movimientos: Movimiento[],
  ): MovimientoCampamentoDto[] {
    return movimientos.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      monto: Number(m.monto),
      descripcion: m.descripcion,
      medioPago: m.medioPago,
      estadoPago: m.estadoPago,
      responsableId: m.responsableId,
      responsableNombre: m.responsable?.nombre ?? 'Desconocido',
    }));
  }

  async remove(id: string): Promise<void> {
    const campamento = await this.findOne(id);

    // Validar que no tenga movimientos asociados
    const check = await this.deletionValidator.canDeleteCampamento(id);
    if (!check.canDelete) {
      throw new BadRequestException(check.reason);
    }

    await this.campamentoRepository.softRemove(campamento);
  }

  /**
   * Elimina un pago de campamento (soft delete)
   * Si el pago tiene un movimiento relacionado (uso de saldo personal),
   * también elimina ese movimiento.
   * @param campamentoId - ID del campamento
   * @param movimientoId - ID del movimiento de INGRESO a eliminar
   * @returns Información sobre los movimientos eliminados
   */
  async eliminarPagoCampamento(
    campamentoId: string,
    movimientoId: string,
  ): Promise<{ movimientosEliminados: string[]; montoRevertido: number }> {
    // 1. Validar que el campamento existe
    await this.findOne(campamentoId);

    // 2. Buscar el movimiento de ingreso
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'campamento',
      campamentoId,
    );

    const movimientoIngreso = movimientos.find(
      (m) =>
        m.id === movimientoId &&
        m.tipo === TipoMovimiento.INGRESO &&
        m.concepto === ConceptoMovimiento.CAMPAMENTO_PAGO,
    );

    if (!movimientoIngreso) {
      throw new NotFoundException(
        `Movimiento de pago con ID ${movimientoId} no encontrado en el campamento`,
      );
    }

    const movimientosAEliminar: string[] = [movimientoIngreso.id];
    const montoRevertido = Number(movimientoIngreso.monto);

    // 3. Si tiene movimiento relacionado (egreso de saldo personal), agregarlo
    if (movimientoIngreso.movimientoRelacionadoId) {
      movimientosAEliminar.push(movimientoIngreso.movimientoRelacionadoId);
    }

    // 4. Eliminar movimientos en transacción
    await this.dataSource.transaction(async (manager) => {
      for (const id of movimientosAEliminar) {
        await manager.softDelete(Movimiento, { id });
      }
    });

    return {
      movimientosEliminados: movimientosAEliminar,
      montoRevertido,
    };
  }

  /**
   * Calcula el total de deuda de todos los campamentos
   * Suma de (costoPorPersona - totalPagado) para cada participante con deuda
   */
  async getTotalDeudaCampamentos(): Promise<{
    total: number;
    cantidad: number;
  }> {
    const campamentos = await this.campamentoRepository.find({
      relations: ['participantes'],
    });

    let total = 0;
    let cantidad = 0;

    for (const campamento of campamentos) {
      const pagosPorParticipante = await this.getPagosPorParticipante(
        campamento.id,
      );

      for (const participante of pagosPorParticipante) {
        if (participante.saldoPendiente > 0) {
          total += participante.saldoPendiente;
          cantidad++;
        }
      }
    }

    return { total, cantidad };
  }
}
