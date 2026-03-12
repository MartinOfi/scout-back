import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
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

  async create(dto: CreateMovimientoDto): Promise<Movimiento> {
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
   * Calcula el saldo de una caja sumando todos sus movimientos
   * Ingresos suman, egresos restan
   */
  async calcularSaldo(cajaId: string): Promise<number> {
    const result: { saldo: string | null } | undefined =
      await this.movimientoRepository
        .createQueryBuilder('m')
        .select(
          `SUM(CASE
          WHEN m.tipo = :ingreso THEN m.monto
          ELSE -m.monto
        END)`,
          'saldo',
        )
        .where('m.caja_id = :cajaId', { cajaId })
        .andWhere('m.deletedAt IS NULL')
        .setParameter('ingreso', TipoMovimiento.INGRESO)
        .getRawOne();

    return Number(result?.saldo ?? 0);
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
  ): Promise<Movimiento> {
    return this.create({
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
    });
  }
}
