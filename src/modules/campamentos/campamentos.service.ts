import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { Campamento } from './entities/campamento.entity';
import { CampamentoParticipante } from './entities/campamento-participante.entity';
import { CreateCampamentoDto } from './dtos/create-campamento.dto';
import { UpdateCampamentoDto } from './dtos/update-campamento.dto';
import { AddParticipanteDto } from './dtos/add-participante.dto';
import { UpdateParticipanteAutorizacionDto } from './dtos/update-participante-autorizacion.dto';
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
  FiltroMovimientosCampamento,
} from '../../common/enums';
import {
  CampamentoDetalleDto,
  ParticipantePagoDto,
  PagoParticipanteDto,
  MovimientoCampamentoDto,
  CampamentoKpisDto,
} from './dtos/campamento-detalle.dto';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';

@Injectable()
export class CampamentosService {
  constructor(
    @InjectRepository(Campamento)
    private readonly campamentoRepository: Repository<Campamento>,
    @InjectRepository(CampamentoParticipante)
    private readonly campamentoParticipanteRepository: Repository<CampamentoParticipante>,
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
      relations: ['participantes', 'participantes.persona'],
      order: { fechaInicio: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Campamento> {
    const campamento = await this.campamentoRepository.findOne({
      where: { id },
      relations: ['participantes', 'participantes.persona'],
    });

    if (!campamento) {
      throw new NotFoundException(`Campamento con ID ${id} no encontrado`);
    }

    return campamento;
  }

  async create(dto: CreateCampamentoDto): Promise<Campamento> {
    const campamento = this.campamentoRepository.create(dto);
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
    await this.findOne(id);
    await this.personasService.findOne(dto.personaId);

    const existing = await this.campamentoParticipanteRepository.findOne({
      where: {
        campamentoId: id,
        personaId: dto.personaId,
        deletedAt: IsNull(),
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Esta persona ya está inscrita en el campamento',
      );
    }

    await this.campamentoParticipanteRepository.save(
      this.campamentoParticipanteRepository.create({
        campamentoId: id,
        personaId: dto.personaId,
        autorizacionEntregada: dto.autorizacionEntregada ?? false,
      }),
    );

    return this.findOne(id);
  }

  async removeParticipante(id: string, personaId: string): Promise<Campamento> {
    const junction = await this.campamentoParticipanteRepository.findOne({
      where: { campamentoId: id, personaId, deletedAt: IsNull() },
    });

    if (!junction) {
      throw new NotFoundException(
        'El participante no está inscrito en el campamento',
      );
    }

    await this.campamentoParticipanteRepository.softDelete(junction.id);

    return this.findOne(id);
  }

  async updateParticipanteAutorizacion(
    campamentoId: string,
    personaId: string,
    dto: UpdateParticipanteAutorizacionDto,
  ): Promise<void> {
    const junction = await this.campamentoParticipanteRepository.findOne({
      where: { campamentoId, personaId, deletedAt: IsNull() },
    });

    if (!junction) {
      throw new NotFoundException(
        'El participante no está inscrito en el campamento',
      );
    }

    await this.campamentoParticipanteRepository.save({
      ...junction,
      autorizacionEntregada: dto.autorizacionEntregada,
    });
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
    registradoPorId?: string,
    fecha?: Date,
    personaAReembolsarId?: string,
  ): Promise<void> {
    const campamento = await this.findOne(campamentoId);
    await this.personasService.findOne(responsableId);

    const cajaGrupo = await this.cajasService.findCajaGrupo();

    await this.movimientosService.create(
      {
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
        fecha,
      },
      registradoPorId,
    );
  }

  async getResumenFinanciero(campamentoId: string): Promise<{
    totalEsperado: number;
    totalRecaudado: number;
    totalGastado: number;
    totalPendienteReembolso: number;
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

    const gastosCampamento = movimientos.filter(
      (m) =>
        m.tipo === TipoMovimiento.EGRESO &&
        m.concepto === ConceptoMovimiento.CAMPAMENTO_GASTO,
    );

    const totalGastado = gastosCampamento
      .filter((m) => m.estadoPago === EstadoPago.PAGADO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const totalPendienteReembolso = gastosCampamento
      .filter((m) => m.estadoPago === EstadoPago.PENDIENTE_REEMBOLSO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    return {
      totalEsperado:
        campamento.participantes.length * Number(campamento.costoPorPersona),
      totalRecaudado,
      totalGastado,
      totalPendienteReembolso,
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
    return campamento.participantes.map((cp) => {
      const datosPago = pagosPorParticipante.get(cp.personaId) || {
        totalPagado: 0,
        pagos: [],
      };

      return {
        participanteId: cp.personaId,
        participanteNombre: cp.persona.nombre,
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
   * @param filtroMovimientos Filter for movements: todos, ingresos, gastos (default: todos)
   */
  async getDetalle(
    campamentoId: string,
    filtroMovimientos?: FiltroMovimientosCampamento,
  ): Promise<CampamentoDetalleDto> {
    // 1. Load campamento with participants
    const campamento = await this.findOne(campamentoId);

    // 2. Load all movements for this campamento
    const todosMovimientos = await this.movimientosService.findByRelatedEntity(
      'campamento',
      campamentoId,
    );

    // 3. Separate payments (INGRESO) from expenses (EGRESO)
    const pagos = todosMovimientos.filter(
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

    // 6. Calculate KPIs (always use all movements for accurate KPIs)
    const kpis = this.calculateKpis(
      participantesDto,
      todosMovimientos,
      costoPorPersona,
    );

    // 7. Filter and build movimientos DTO based on filter
    const movimientosFiltrados = this.filterMovimientos(
      todosMovimientos,
      filtroMovimientos,
    );
    const movimientosDto = this.buildMovimientosDto(movimientosFiltrados);

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
   * Filter movements based on the specified filter
   */
  private filterMovimientos(
    movimientos: Movimiento[],
    filtro?: FiltroMovimientosCampamento,
  ): Movimiento[] {
    switch (filtro) {
      case FiltroMovimientosCampamento.INGRESOS:
        return movimientos.filter((m) => m.tipo === TipoMovimiento.INGRESO);

      case FiltroMovimientosCampamento.EGRESOS:
        // Todos los egresos (incluyendo USO_SALDO_PERSONAL)
        return movimientos.filter((m) => m.tipo === TipoMovimiento.EGRESO);

      case FiltroMovimientosCampamento.GASTOS:
        // Solo gastos reales del campamento (excluye USO_SALDO_PERSONAL)
        return movimientos.filter(
          (m) =>
            m.tipo === TipoMovimiento.EGRESO &&
            m.concepto === ConceptoMovimiento.CAMPAMENTO_GASTO,
        );

      case FiltroMovimientosCampamento.TODOS:
      default:
        return movimientos;
    }
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
    participantes: CampamentoParticipante[],
    pagosPorParticipante: Map<
      string,
      { totalPagado: number; pagos: PagoParticipanteDto[] }
    >,
    costoPorPersona: number,
  ): ParticipantePagoDto[] {
    return participantes.map((cp) => {
      const datosPago = pagosPorParticipante.get(cp.personaId) ?? {
        totalPagado: 0,
        pagos: [],
      };

      const saldoPendiente = costoPorPersona - datosPago.totalPagado;
      const estadoPago = this.determineEstadoPago(
        datosPago.totalPagado,
        costoPorPersona,
      );

      const rama =
        'rama' in cp.persona ? (cp.persona as { rama: unknown }).rama : null;

      return {
        id: cp.personaId,
        nombre: cp.persona.nombre,
        tipo: cp.persona.tipo,
        rama: rama as ParticipantePagoDto['rama'],
        costoPorPersona,
        totalPagado: datosPago.totalPagado,
        saldoPendiente,
        estadoPago,
        autorizacionEntregada: cp.autorizacionEntregada,
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
   * Calculate all KPIs for the campamento.
   * Discriminates between effective expenses (impacted caja) and
   * pending reimbursements (committed but money still in caja).
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

    const gastosCampamento = movimientos.filter(
      (m) =>
        m.tipo === TipoMovimiento.EGRESO &&
        m.concepto === ConceptoMovimiento.CAMPAMENTO_GASTO,
    );

    const totalGastado = gastosCampamento
      .filter((m) => m.estadoPago === EstadoPago.PAGADO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const totalPendienteReembolso = gastosCampamento
      .filter((m) => m.estadoPago === EstadoPago.PENDIENTE_REEMBOLSO)
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
      totalPendienteReembolso,
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
      concepto: m.concepto,
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
    const result = await this.campamentoRepository
      .createQueryBuilder('c')
      .select(
        `SUM(GREATEST(0, c."costoPorPersona" - COALESCE(pagos.total_pagado, 0)))`,
        'total',
      )
      .addSelect(
        `COUNT(CASE WHEN c."costoPorPersona" - COALESCE(pagos.total_pagado, 0) > 0 THEN 1 END)`,
        'cantidad',
      )
      .innerJoin('c.participantes', 'cp')
      .innerJoin('cp.persona', 'p')
      .leftJoin(
        (qb) =>
          qb
            .select('m.responsable_id', 'responsable_id')
            .addSelect('m.campamento_id', 'campamento_id')
            .addSelect('SUM(m.monto)', 'total_pagado')
            .from('movimientos', 'm')
            .where('m."deletedAt" IS NULL')
            .andWhere('m.tipo = :ingreso', { ingreso: 'ingreso' })
            .andWhere('m.concepto = :concepto', {
              concepto: 'campamento_pago',
            })
            .andWhere('m.campamento_id IS NOT NULL')
            .groupBy('m.responsable_id')
            .addGroupBy('m.campamento_id'),
        'pagos',
        'pagos.responsable_id = p.id AND pagos.campamento_id = c.id',
      )
      .where('c.deletedAt IS NULL')
      .getRawOne<{ total: string | null; cantidad: string }>();

    return {
      total: Number(result?.total ?? 0),
      cantidad: Number(result?.cantidad ?? 0),
    };
  }
}
