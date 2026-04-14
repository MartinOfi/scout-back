import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  FindOptionsWhere,
  In,
  EntityManager,
  DataSource,
} from 'typeorm';
import { Movimiento } from './entities/movimiento.entity';
import { CreateMovimientoDto } from './dtos/create-movimiento.dto';
import { UpdateMovimientoDto } from './dtos/update-movimiento.dto';
import { FilterMovimientosDto } from './dtos/filter-movimientos.dto';
import { CreateTransferenciaDto } from './dtos/create-transferencia.dto';
import { CajasService } from '../cajas/cajas.service';
import { PersonasService } from '../personas/personas.service';
import { PaginatedResponseDto } from '../../common/dtos';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  EstadoPago,
  MedioPago,
} from '../../common/enums';

@Injectable()
export class MovimientosService {
  constructor(
    @InjectRepository(Movimiento)
    private readonly movimientoRepository: Repository<Movimiento>,
    @Inject(forwardRef(() => CajasService))
    private readonly cajasService: CajasService,
    @Inject(forwardRef(() => PersonasService))
    private readonly personasService: PersonasService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Movimiento[]> {
    return this.movimientoRepository.find({
      relations: ['caja', 'responsable', 'personaAReembolsar'],
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }

  async findRecientes(cantidad = 10): Promise<Movimiento[]> {
    return this.movimientoRepository.find({
      relations: ['caja', 'responsable', 'personaAReembolsar'],
      order: { fecha: 'DESC', createdAt: 'DESC' },
      take: cantidad,
    });
  }

  async findWithFilters(
    filters: FilterMovimientosDto,
  ): Promise<PaginatedResponseDto<Movimiento>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const queryBuilder = this.movimientoRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.caja', 'caja')
      .leftJoinAndSelect('m.responsable', 'responsable')
      .leftJoinAndSelect('m.personaAReembolsar', 'personaAReembolsar')
      .where('m.deletedAt IS NULL');

    if (filters.cajaId) {
      queryBuilder.andWhere('m.caja_id = :cajaId', { cajaId: filters.cajaId });
    }

    if (filters.tipoCaja && filters.tipoCaja.length > 0) {
      queryBuilder.andWhere('caja.tipo IN (:...tipoCaja)', {
        tipoCaja: filters.tipoCaja,
      });
    }

    if (filters.tipo) {
      queryBuilder.andWhere('m.tipo = :tipo', { tipo: filters.tipo });
    }

    if (filters.concepto) {
      queryBuilder.andWhere('m.concepto = :concepto', {
        concepto: filters.concepto,
      });
    }

    if (filters.categoria) {
      queryBuilder.andWhere('m.categoria = :categoria', {
        categoria: filters.categoria,
      });
    }

    if (filters.responsableId) {
      queryBuilder.andWhere('m.responsable_id = :responsableId', {
        responsableId: filters.responsableId,
      });
    }

    if (filters.fechaInicio && filters.fechaFin) {
      queryBuilder.andWhere('m.fecha BETWEEN :fechaInicio AND :fechaFin', {
        fechaInicio: filters.fechaInicio,
        fechaFin: filters.fechaFin,
      });
    } else if (filters.fechaInicio) {
      queryBuilder.andWhere('m.fecha >= :fechaInicio', {
        fechaInicio: filters.fechaInicio,
      });
    } else if (filters.fechaFin) {
      queryBuilder.andWhere('m.fecha <= :fechaFin', {
        fechaFin: filters.fechaFin,
      });
    }

    if (filters.estadoPago) {
      queryBuilder.andWhere('m.estadoPago = :estadoPago', {
        estadoPago: filters.estadoPago,
      });
    }

    const [data, total] = await queryBuilder
      .orderBy('m.fecha', 'DESC')
      .addOrderBy('m.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(data, page, limit, total);
  }

  async findByCaja(cajaId: string): Promise<Movimiento[]> {
    return this.movimientoRepository.find({
      where: { cajaId },
      relations: ['responsable', 'personaAReembolsar'],
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByResponsable(responsableId: string): Promise<Movimiento[]> {
    return this.movimientoRepository.find({
      where: { responsableId },
      relations: ['caja', 'personaAReembolsar'],
      order: { fecha: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByFechaRange(
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<Movimiento[]> {
    return this.movimientoRepository.find({
      where: {
        fecha: Between(fechaInicio, fechaFin),
      },
      relations: ['caja', 'responsable', 'personaAReembolsar'],
      order: { fecha: 'DESC' },
    });
  }

  async findByRelatedEntity(
    entityType: 'evento' | 'campamento' | 'inscripcion' | 'cuota',
    entityId: string,
  ): Promise<Movimiento[]> {
    const whereClause: FindOptionsWhere<Movimiento> = {};

    switch (entityType) {
      case 'evento':
        whereClause.eventoId = entityId;
        break;
      case 'campamento':
        whereClause.campamentoId = entityId;
        break;
      case 'inscripcion':
        whereClause.inscripcionId = entityId;
        break;
      case 'cuota':
        whereClause.cuotaId = entityId;
        break;
    }

    return this.movimientoRepository.find({
      where: whereClause,
      relations: ['caja', 'responsable', 'personaAReembolsar'],
      order: { fecha: 'DESC' },
    });
  }

  async findMovimientosByEvento(
    eventoId: string,
    filters: { tipo?: TipoMovimiento; concepto?: ConceptoMovimiento } = {},
  ): Promise<Movimiento[]> {
    const where: FindOptionsWhere<Movimiento> = { eventoId };

    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.concepto) where.concepto = filters.concepto;

    return this.movimientoRepository.find({
      where,
      relations: ['caja', 'responsable', 'personaAReembolsar'],
      order: { fecha: 'DESC' },
    });
  }

  /**
   * Batch load movements for multiple inscripciones in a single query
   * Eliminates N+1 query problem when loading multiple inscripciones
   * @param inscripcionIds Array of inscripcion IDs
   * @returns Map of inscripcionId -> Movimiento[]
   */
  async findByInscripcionIds(
    inscripcionIds: string[],
  ): Promise<Map<string, Movimiento[]>> {
    if (inscripcionIds.length === 0) {
      return new Map();
    }

    const movimientos = await this.movimientoRepository.find({
      where: { inscripcionId: In(inscripcionIds) },
      relations: ['caja', 'responsable', 'personaAReembolsar'],
      order: { fecha: 'DESC' },
    });

    // Group by inscripcionId
    const result = new Map<string, Movimiento[]>();
    for (const mov of movimientos) {
      if (!mov.inscripcionId) continue;
      const existing = result.get(mov.inscripcionId) || [];
      result.set(mov.inscripcionId, [...existing, mov]);
    }

    return result;
  }

  /**
   * Obtiene todos los reembolsos pendientes agrupados por persona
   * PRD F7: Deudas a personas externas
   */
  async findReembolsosPendientes(): Promise<
    {
      personaId: string;
      personaNombre: string;
      totalPendiente: number;
      movimientos: Movimiento[];
    }[]
  > {
    const movimientos = await this.movimientoRepository.find({
      where: { estadoPago: EstadoPago.PENDIENTE_REEMBOLSO },
      relations: ['personaAReembolsar', 'caja'],
      order: { fecha: 'DESC' },
    });

    // Agrupar por persona a reembolsar
    const agrupado = new Map<
      string,
      {
        personaNombre: string;
        totalPendiente: number;
        movimientos: Movimiento[];
      }
    >();

    for (const mov of movimientos) {
      if (!mov.personaAReembolsarId || !mov.personaAReembolsar) continue;

      const current = agrupado.get(mov.personaAReembolsarId) || {
        personaNombre: mov.personaAReembolsar.nombre,
        totalPendiente: 0,
        movimientos: [],
      };

      current.totalPendiente += Number(mov.monto);
      current.movimientos.push(mov);
      agrupado.set(mov.personaAReembolsarId, current);
    }

    return Array.from(agrupado.entries()).map(([personaId, data]) => ({
      personaId,
      ...data,
    }));
  }

  /**
   * Lightweight version for consolidado: returns only totals, no entities.
   * Single aggregation query instead of loading all movements + relations.
   */
  async getReembolsosPendientesResumen(): Promise<{
    total: number;
    cantidad: number;
  }> {
    const result = await this.movimientoRepository
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.monto), 0)', 'total')
      .addSelect('COUNT(DISTINCT m.persona_a_reembolsar_id)', 'cantidad')
      .where('m.estadoPago = :estado', {
        estado: EstadoPago.PENDIENTE_REEMBOLSO,
      })
      .andWhere('m.deletedAt IS NULL')
      .andWhere('m.persona_a_reembolsar_id IS NOT NULL')
      .getRawOne<{ total: string; cantidad: string }>();

    return {
      total: Number(result?.total ?? 0),
      cantidad: Number(result?.cantidad ?? 0),
    };
  }

  async findOne(id: string): Promise<Movimiento> {
    const movimiento = await this.movimientoRepository.findOne({
      where: { id },
      relations: ['caja', 'responsable', 'personaAReembolsar'],
    });

    if (!movimiento) {
      throw new NotFoundException(`Movimiento con ID ${id} no encontrado`);
    }

    return movimiento;
  }

  async create(
    dto: CreateMovimientoDto,
    registradoPorId?: string,
  ): Promise<Movimiento> {
    await this.validateCreateDtoReferences(dto);
    const entity = this.buildMovimientoEntity(dto, registradoPorId);
    return this.movimientoRepository.save(entity);
  }

  /**
   * Same as `create()` but executed against an externally-provided
   * EntityManager so that the caller can include this write inside
   * an open transaction (e.g. registrarVenta needs to insert the
   * movimiento and the venta atomically).
   *
   * The reference validations are kept identical so the contract
   * does not depend on which path the caller chose.
   */
  async createWithManager(
    manager: EntityManager,
    dto: CreateMovimientoDto,
    registradoPorId?: string,
  ): Promise<Movimiento> {
    await this.validateCreateDtoReferences(dto);
    const entity = manager.create(
      Movimiento,
      this.buildMovimientoPayload(dto, registradoPorId),
    );
    return manager.save(entity);
  }

  /**
   * Transfer funds between two cajas atomically.
   *
   * Creates an EGRESO in cajaOrigen and an INGRESO in cajaDestino, both with
   * concepto = TRANSFERENCIA_ENTRE_CAJAS, linked via movimientoRelacionadoId.
   *
   * Validations run BEFORE opening the transaction:
   *  - cajaOrigen != cajaDestino
   *  - monto > 0 (class-validator also enforces, double-checked here)
   *  - both cajas exist (delegated to CajasService)
   *  - responsable exists (delegated to PersonasService)
   *  - origen has enough balance (calcularSaldo)
   *
   * All writes happen inside a single dataSource.transaction so any failure
   * rolls back both movimientos.
   */
  async crearTransferencia(
    dto: CreateTransferenciaDto,
  ): Promise<{ egreso: Movimiento; ingreso: Movimiento }> {
    if (dto.cajaOrigenId === dto.cajaDestinoId) {
      throw new BadRequestException(
        'La caja de origen y destino deben ser distintas',
      );
    }
    if (dto.monto <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }

    await this.personasService.findOne(dto.responsableId);
    await this.cajasService.findOne(dto.cajaOrigenId);
    await this.cajasService.findOne(dto.cajaDestinoId);

    const saldoOrigen = await this.calcularSaldo(dto.cajaOrigenId);
    if (saldoOrigen < dto.monto) {
      throw new BadRequestException(
        `Saldo insuficiente en caja origen (disponible: ${saldoOrigen}, requerido: ${dto.monto})`,
      );
    }

    const fecha = dto.fecha ?? new Date();

    return this.dataSource.transaction(async (manager) => {
      const egresoPayload: Partial<Movimiento> = {
        cajaId: dto.cajaOrigenId,
        tipo: TipoMovimiento.EGRESO,
        monto: dto.monto,
        concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
        descripcion: dto.descripcion ?? null,
        responsableId: dto.responsableId,
        medioPago: MedioPago.TRANSFERENCIA,
        estadoPago: EstadoPago.PAGADO,
        requiereComprobante: false,
        fecha,
        registradoPorId: dto.responsableId,
      };
      const ingresoPayload: Partial<Movimiento> = {
        cajaId: dto.cajaDestinoId,
        tipo: TipoMovimiento.INGRESO,
        monto: dto.monto,
        concepto: ConceptoMovimiento.TRANSFERENCIA_ENTRE_CAJAS,
        descripcion: dto.descripcion ?? null,
        responsableId: dto.responsableId,
        medioPago: MedioPago.TRANSFERENCIA,
        estadoPago: EstadoPago.PAGADO,
        requiereComprobante: false,
        fecha,
        registradoPorId: dto.responsableId,
      };

      const egresoEntity = manager.create(Movimiento, egresoPayload);
      const egreso = await manager.save(egresoEntity);

      const ingresoEntity = manager.create(Movimiento, ingresoPayload);
      const ingreso = await manager.save(ingresoEntity);

      await manager.update(Movimiento, egreso.id, {
        movimientoRelacionadoId: ingreso.id,
      });
      await manager.update(Movimiento, ingreso.id, {
        movimientoRelacionadoId: egreso.id,
      });

      return { egreso, ingreso };
    });
  }

  async update(id: string, dto: UpdateMovimientoDto): Promise<Movimiento> {
    const movimiento = await this.findOne(id);
    Object.assign(movimiento, dto);
    return this.movimientoRepository.save(movimiento);
  }

  async remove(id: string): Promise<void> {
    const movimiento = await this.findOne(id);
    await this.movimientoRepository.softRemove(movimiento);
  }

  /**
   * Soft delete a movimiento using a caller-provided EntityManager so
   * the operation participates in an outer transaction.
   *
   * Idempotent: if the row is already soft-deleted (`deletedAt IS NOT NULL`)
   * the underlying UPDATE affects 0 rows and the call returns silently.
   * This makes concurrent delete attempts safe without explicit locking.
   */
  async softRemoveWithManager(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    const movimiento = await manager.findOne(Movimiento, { where: { id } });
    if (!movimiento) {
      return;
    }
    await manager.softRemove(movimiento);
  }

  // ----- create helpers (private) -----

  private async validateCreateDtoReferences(
    dto: CreateMovimientoDto,
  ): Promise<void> {
    await this.cajasService.findOne(dto.cajaId);
    await this.personasService.findOne(dto.responsableId);
    if (dto.personaAReembolsarId) {
      await this.personasService.findOne(dto.personaAReembolsarId);
    }
  }

  private buildMovimientoPayload(
    dto: CreateMovimientoDto,
    registradoPorId?: string,
  ): Partial<Movimiento> {
    return {
      ...dto,
      fecha: dto.fecha ?? new Date(),
      ...(registradoPorId ? { registradoPorId } : {}),
    };
  }

  private buildMovimientoEntity(
    dto: CreateMovimientoDto,
    registradoPorId?: string,
  ): Movimiento {
    return this.movimientoRepository.create(
      this.buildMovimientoPayload(dto, registradoPorId),
    );
  }

  /**
   * Calcula el saldo de una caja sumando todos sus movimientos.
   * Ingresos suman, egresos PAGADOS restan.
   * Egresos con PENDIENTE_REEMBOLSO no afectan el saldo: la plata
   * sigue en la caja hasta que se emita el reembolso real.
   */
  async calcularSaldo(cajaId: string): Promise<number> {
    const result: { saldo: string | null } | undefined =
      await this.movimientoRepository
        .createQueryBuilder('m')
        .select(
          `SUM(CASE
          WHEN m.tipo = :ingreso THEN m.monto
          WHEN m.tipo = :egreso AND m.estadoPago != :pendienteReembolso THEN -m.monto
          ELSE 0
        END)`,
          'saldo',
        )
        .where('m.caja_id = :cajaId', { cajaId })
        .andWhere('m.deletedAt IS NULL')
        .setParameter('ingreso', TipoMovimiento.INGRESO)
        .setParameter('egreso', TipoMovimiento.EGRESO)
        .setParameter('pendienteReembolso', EstadoPago.PENDIENTE_REEMBOLSO)
        .getRawOne();

    return Number(result?.saldo ?? 0);
  }

  /**
   * Calcula el saldo de múltiples cajas en una sola consulta.
   * Cajas sin movimientos retornan saldo 0.
   */
  async calcularSaldosBatch(cajaIds: string[]): Promise<Map<string, number>> {
    if (cajaIds.length === 0) {
      return new Map();
    }

    const results: { caja_id: string; saldo: string | null }[] =
      await this.movimientoRepository
        .createQueryBuilder('m')
        .select('m.caja_id', 'caja_id')
        .addSelect(
          `SUM(CASE
          WHEN m.tipo = :ingreso THEN m.monto
          WHEN m.tipo = :egreso AND m.estadoPago != :pendienteReembolso THEN -m.monto
          ELSE 0
        END)`,
          'saldo',
        )
        .where('m.caja_id IN (:...cajaIds)', { cajaIds })
        .andWhere('m.deletedAt IS NULL')
        .groupBy('m.caja_id')
        .setParameter('ingreso', TipoMovimiento.INGRESO)
        .setParameter('egreso', TipoMovimiento.EGRESO)
        .setParameter('pendienteReembolso', EstadoPago.PENDIENTE_REEMBOLSO)
        .getRawMany();

    const saldoMap = new Map<string, number>();
    for (const id of cajaIds) {
      saldoMap.set(id, 0);
    }
    for (const row of results) {
      saldoMap.set(row.caja_id, Number(row.saldo ?? 0));
    }

    return saldoMap;
  }

  /**
   * Calcula el saldo de una persona en su cuenta personal
   * basado en movimientos de su caja personal
   */
  async calcularSaldoPersona(cajaPersonalId: string): Promise<number> {
    return this.calcularSaldo(cajaPersonalId);
  }

  /**
   * Registra un gasto general (no asociado a eventos/campamentos)
   * PRD F13: Gastos generales
   */
  async registrarGastoGeneral(
    cajaId: string,
    monto: number,
    descripcion: string,
    responsableId: string,
    medioPago: MedioPago,
    estadoPago: EstadoPago,
    personaAReembolsarId?: string,
    requiereComprobante = true,
    registradoPorId?: string,
  ): Promise<Movimiento> {
    return this.create(
      {
        cajaId,
        tipo: TipoMovimiento.EGRESO,
        monto,
        concepto: ConceptoMovimiento.GASTO_GENERAL,
        descripcion,
        responsableId,
        medioPago,
        estadoPago,
        personaAReembolsarId,
        requiereComprobante,
      },
      registradoPorId,
    );
  }
}
