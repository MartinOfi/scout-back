import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, In } from 'typeorm';
import { Movimiento } from './entities/movimiento.entity';
import { CreateMovimientoDto } from './dtos/create-movimiento.dto';
import { UpdateMovimientoDto } from './dtos/update-movimiento.dto';
import { FilterMovimientosDto } from './dtos/filter-movimientos.dto';
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
  ) {}

  async findAll(): Promise<Movimiento[]> {
    return this.movimientoRepository.find({
      relations: ['caja', 'responsable', 'personaAReembolsar'],
      order: { fecha: 'DESC', createdAt: 'DESC' },
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
    // Validar que la caja existe
    await this.cajasService.findOne(dto.cajaId);

    // Validar que el responsable existe
    await this.personasService.findOne(dto.responsableId);

    // Validar personaAReembolsar si existe
    if (dto.personaAReembolsarId) {
      await this.personasService.findOne(dto.personaAReembolsarId);
    }

    const movimiento = this.movimientoRepository.create({
      ...dto,
      fecha: dto.fecha ?? new Date(),
      ...(registradoPorId ? { registradoPorId } : {}),
    });

    return this.movimientoRepository.save(movimiento);
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
