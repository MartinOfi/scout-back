import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Inscripcion } from './entities/inscripcion.entity';
import { CreateInscripcionDto } from './dtos/create-inscripcion.dto';
import { UpdateInscripcionDto } from './dtos/update-inscripcion.dto';
import { PagarInscripcionDto } from './dtos/pagar-inscripcion.dto';
import { GetInscripcionesQueryDto } from './dtos/get-inscripciones-query.dto';
import {
  InscripcionResponseDto,
  MovimientoInscripcionDto,
} from './dtos/inscripcion-response.dto';
import {
  InscripcionesConsolidadoDto,
  DistribucionPorRamaDto,
} from './dtos/inscripciones-consolidado.dto';
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { PagosService } from '../pagos/pagos.service';
import {
  EstadoInscripcion,
  TipoInscripcion,
  TipoMovimiento,
  ConceptoMovimiento,
  TipoDeuda,
  Rama,
  PersonaType,
  MedioPago,
} from '../../common/enums';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';

@Injectable()
export class InscripcionesService {
  constructor(
    @InjectRepository(Inscripcion)
    private readonly inscripcionRepository: Repository<Inscripcion>,
    @Inject(forwardRef(() => PersonasService))
    private readonly personasService: PersonasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
    @Inject(forwardRef(() => PagosService))
    private readonly pagosService: PagosService,
    private readonly dataSource: DataSource,
    private readonly deletionValidator: DeletionValidatorService,
  ) {}

  /**
   * Transforma una inscripción a DTO con campos calculados
   * @param inscripcion La inscripción a transformar
   * @param preloadedMovimientos Movimientos pre-cargados (para batch loading)
   */
  private toResponseDtoWithMovimientos(
    inscripcion: Inscripcion,
    movimientos: {
      id: string;
      monto: number;
      medioPago: MedioPago;
      fecha: Date;
      descripcion: string | null;
      tipo: TipoMovimiento;
      concepto: ConceptoMovimiento;
    }[],
  ): InscripcionResponseDto {
    // Include ALL movements (both INGRESO and EGRESO from personal accounts)
    const movimientosDto: MovimientoInscripcionDto[] = movimientos.map((m) => ({
      id: m.id,
      monto: Number(m.monto),
      medioPago: m.medioPago,
      fecha: m.fecha,
      descripcion: m.descripcion,
      tipo: m.tipo,
      concepto: m.concepto,
    }));

    // Calculate montoPagado only from INGRESO movements (money that entered the group)
    const montoPagado = movimientos
      .filter((m) => m.tipo === TipoMovimiento.INGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);
    const montoTotal = Number(inscripcion.montoTotal);
    const montoBonificado = Number(inscripcion.montoBonificado);
    const saldoPendiente = Math.max(
      0,
      montoTotal - montoBonificado - montoPagado,
    );

    let estado: EstadoInscripcion;
    if (saldoPendiente === 0) {
      estado = EstadoInscripcion.PAGADO;
    } else if (montoPagado > 0 || montoBonificado > 0) {
      estado = EstadoInscripcion.PARCIAL;
    } else {
      estado = EstadoInscripcion.PENDIENTE;
    }

    return {
      id: inscripcion.id,
      personaId: inscripcion.personaId,
      tipo: inscripcion.tipo,
      ano: inscripcion.ano,
      montoTotal,
      montoBonificado,
      declaracionDeSalud: inscripcion.declaracionDeSalud,
      autorizacionDeImagen: inscripcion.autorizacionDeImagen,
      salidasCercanas: inscripcion.salidasCercanas,
      autorizacionIngreso: inscripcion.autorizacionIngreso,
      certificadoAptitudFisica: inscripcion.certificadoAptitudFisica,
      createdAt: inscripcion.createdAt,
      updatedAt: inscripcion.updatedAt,
      estado,
      montoPagado,
      saldoPendiente,
      persona: inscripcion.persona
        ? {
            id: inscripcion.persona.id,
            nombre: inscripcion.persona.nombre,
            tipo: inscripcion.persona.tipo,
            rama: (inscripcion.persona as { rama?: Rama }).rama ?? null,
          }
        : undefined,
      movimientos: movimientosDto,
    };
  }

  /**
   * Transforma una inscripción a DTO (carga movimientos individualmente)
   * Use toResponseDtos for batch operations to avoid N+1 queries
   */
  private async toResponseDto(
    inscripcion: Inscripcion,
  ): Promise<InscripcionResponseDto> {
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'inscripcion',
      inscripcion.id,
    );

    return this.toResponseDtoWithMovimientos(inscripcion, movimientos);
  }

  /**
   * Transforma múltiples inscripciones a DTOs con batch loading
   * Reduces N+1 queries to 2 queries total
   */
  private async toResponseDtos(
    inscripciones: Inscripcion[],
  ): Promise<InscripcionResponseDto[]> {
    if (inscripciones.length === 0) return [];

    // Batch load ALL movements in a single query
    const inscripcionIds = inscripciones.map((i) => i.id);
    const movimientosByInscripcion =
      await this.movimientosService.findByInscripcionIds(inscripcionIds);

    // Transform with pre-loaded movements (no additional queries)
    return inscripciones.map((inscripcion) =>
      this.toResponseDtoWithMovimientos(
        inscripcion,
        movimientosByInscripcion.get(inscripcion.id) || [],
      ),
    );
  }

  /**
   * Check if inscription has money debt (saldoPendiente > 0)
   */
  private hasMoneyDebt(dto: InscripcionResponseDto): boolean {
    return dto.saldoPendiente > 0;
  }

  /**
   * Check if inscription has documentation debt (missing documents)
   * Only applies to SCOUT_ARGENTINA inscriptions
   */
  private hasDocumentationDebt(dto: InscripcionResponseDto): boolean {
    if (dto.tipo !== TipoInscripcion.SCOUT_ARGENTINA) {
      return false;
    }
    return (
      !dto.declaracionDeSalud ||
      !dto.autorizacionDeImagen ||
      !dto.salidasCercanas ||
      !dto.autorizacionIngreso ||
      !dto.certificadoAptitudFisica
    );
  }

  /**
   * Check if inscription matches the specified debt type filter
   * @param dto The inscription response DTO
   * @param tipoDeuda Optional debt type filter. If not specified, matches any debt.
   */
  private matchesDebtType(
    dto: InscripcionResponseDto,
    tipoDeuda?: TipoDeuda,
  ): boolean {
    const hasMoney = this.hasMoneyDebt(dto);
    const hasDocs = this.hasDocumentationDebt(dto);

    if (!tipoDeuda) {
      // No specific type: return any debtor (money OR documentation)
      return hasMoney || hasDocs;
    }

    switch (tipoDeuda) {
      case TipoDeuda.DINERO:
        return hasMoney;
      case TipoDeuda.DOCUMENTACION:
        return hasDocs;
      case TipoDeuda.AMBOS:
        return hasMoney && hasDocs;
      default:
        return hasMoney || hasDocs;
    }
  }

  async findAll(
    query?: GetInscripcionesQueryDto,
  ): Promise<InscripcionResponseDto[]> {
    const where: { ano?: number; tipo?: TipoInscripcion } = {};

    if (query?.ano) {
      where.ano = query.ano;
    }
    if (query?.tipo) {
      where.tipo = query.tipo;
    }

    const inscripciones = await this.inscripcionRepository.find({
      where: Object.keys(where).length > 0 ? where : undefined,
      relations: ['persona'],
      order: { ano: 'DESC', createdAt: 'DESC' },
    });

    let dtos = await this.toResponseDtos(inscripciones);

    // Filtrar por rama o tipo de persona
    if (query?.rama) {
      dtos = this.filterByRamaOrPersonaType(dtos, query.rama);
    }

    // Aplicar filtro de deudores si está activo
    if (query?.tipoDeuda) {
      dtos = dtos.filter((dto) => this.matchesDebtType(dto, query.tipoDeuda));
    }

    return dtos;
  }

  /**
   * Filter inscriptions by rama or persona type
   * - If rama is a Rama value (Manada, Unidad, etc.): show only Protagonistas with that rama
   * - If rama is 'educador': show only Educadores (regardless of their rama)
   */
  private filterByRamaOrPersonaType(
    dtos: InscripcionResponseDto[],
    ramaFilter: Rama | typeof PersonaType.EDUCADOR,
  ): InscripcionResponseDto[] {
    if (ramaFilter === PersonaType.EDUCADOR) {
      // Filter only educators (any rama or no rama)
      return dtos.filter((dto) => dto.persona?.tipo === PersonaType.EDUCADOR);
    }

    // Filter by rama - only show Protagonistas with matching rama
    // Educators should NOT appear even if they have the same rama
    return dtos.filter(
      (dto) =>
        dto.persona?.rama === ramaFilter &&
        dto.persona?.tipo === PersonaType.PROTAGONISTA,
    );
  }

  async findByPersona(personaId: string): Promise<InscripcionResponseDto[]> {
    const inscripciones = await this.inscripcionRepository.find({
      where: { personaId },
      relations: ['persona'],
      order: { ano: 'DESC' },
    });
    return this.toResponseDtos(inscripciones);
  }

  async findByAno(
    ano: number,
    tipo?: TipoInscripcion,
  ): Promise<InscripcionResponseDto[]> {
    const where: { ano: number; tipo?: TipoInscripcion } = { ano };
    if (tipo) {
      where.tipo = tipo;
    }

    const inscripciones = await this.inscripcionRepository.find({
      where,
      relations: ['persona'],
      order: { createdAt: 'DESC' },
    });
    return this.toResponseDtos(inscripciones);
  }

  async findByAnoAndTipo(
    ano: number,
    tipo: TipoInscripcion,
  ): Promise<InscripcionResponseDto[]> {
    const inscripciones = await this.inscripcionRepository.find({
      where: { ano, tipo },
      relations: ['persona'],
      order: { createdAt: 'DESC' },
    });
    return this.toResponseDtos(inscripciones);
  }

  async findOne(id: string): Promise<InscripcionResponseDto> {
    const inscripcion = await this.findOneEntity(id);
    return this.toResponseDto(inscripcion);
  }

  /**
   * Internal method to get raw entity (used by other methods)
   */
  private async findOneEntity(id: string): Promise<Inscripcion> {
    const inscripcion = await this.inscripcionRepository.findOne({
      where: { id },
      relations: ['persona'],
    });

    if (!inscripcion) {
      throw new NotFoundException(`Inscripción con ID ${id} no encontrada`);
    }

    return inscripcion;
  }

  /**
   * @deprecated Use findOne instead - returns same data
   */
  async findOneWithEstado(id: string): Promise<InscripcionResponseDto> {
    return this.findOne(id);
  }

  async registrarInscripcion(
    dto: CreateInscripcionDto,
    registradoPorId?: string,
  ): Promise<InscripcionResponseDto> {
    await this.personasService.findOne(dto.personaId);

    const existente = await this.inscripcionRepository.findOne({
      where: {
        personaId: dto.personaId,
        ano: dto.ano,
        tipo: dto.tipo,
      },
    });

    if (existente) {
      throw new BadRequestException(
        `Ya existe una inscripción de tipo ${dto.tipo} para esta persona en el año ${dto.ano}`,
      );
    }

    const montoBonificado = dto.montoBonificado ?? 0;
    if (montoBonificado > dto.montoTotal) {
      throw new BadRequestException(
        'El monto bonificado no puede exceder el monto total',
      );
    }

    const montoPagado = dto.montoPagado ?? 0;
    const montoConSaldoPersonal = dto.montoConSaldoPersonal ?? 0;
    const montoTotalPago = montoPagado + montoConSaldoPersonal;

    // Campos de autorización solo aplican a SCOUT_ARGENTINA
    const esScoutArgentina = dto.tipo === TipoInscripcion.SCOUT_ARGENTINA;

    // Usar transacción para crear inscripción y movimientos
    return this.dataSource.transaction(async (manager) => {
      const inscripcion = manager.create(Inscripcion, {
        personaId: dto.personaId,
        tipo: dto.tipo,
        ano: dto.ano,
        montoTotal: dto.montoTotal,
        montoBonificado,
        // Autorizaciones: solo se guardan para SCOUT_ARGENTINA, siempre false para GRUPO
        declaracionDeSalud: esScoutArgentina
          ? (dto.declaracionDeSalud ?? false)
          : false,
        autorizacionDeImagen: esScoutArgentina
          ? (dto.autorizacionDeImagen ?? false)
          : false,
        salidasCercanas: esScoutArgentina
          ? (dto.salidasCercanas ?? false)
          : false,
        autorizacionIngreso: esScoutArgentina
          ? (dto.autorizacionIngreso ?? false)
          : false,
        certificadoAptitudFisica: esScoutArgentina
          ? (dto.certificadoAptitudFisica ?? false)
          : false,
      });

      const savedInscripcion = await manager.save(inscripcion);

      // Si hay un pago inicial (efectivo/transferencia o saldo personal), usar PagosService
      if (montoTotalPago > 0) {
        const concepto =
          dto.tipo === TipoInscripcion.SCOUT_ARGENTINA
            ? ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA
            : ConceptoMovimiento.INSCRIPCION_GRUPO;

        await this.pagosService.ejecutarPagoConManager(manager, {
          personaId: dto.personaId,
          montoTotal: montoTotalPago,
          montoConSaldoPersonal,
          medioPago: dto.medioPago,
          concepto,
          inscripcionId: savedInscripcion.id,
          descripcion: `Pago inscripción ${dto.tipo} ${dto.ano}`,
          registradoPorId,
        });
      }

      // Reload with persona relation for response
      const reloaded = await manager.findOne(Inscripcion, {
        where: { id: savedInscripcion.id },
        relations: ['persona'],
      });

      return this.toResponseDto(reloaded!);
    });
  }

  async getMontoPagado(inscripcionId: string): Promise<number> {
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'inscripcion',
      inscripcionId,
    );

    return movimientos
      .filter((m) => m.tipo === TipoMovimiento.INGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);
  }

  async getEstado(inscripcion: Inscripcion): Promise<EstadoInscripcion> {
    const montoPagado = await this.getMontoPagado(inscripcion.id);
    const totalCubierto = montoPagado + Number(inscripcion.montoBonificado);

    if (totalCubierto >= Number(inscripcion.montoTotal)) {
      return EstadoInscripcion.PAGADO;
    }
    if (totalCubierto > 0) {
      return EstadoInscripcion.PARCIAL;
    }
    return EstadoInscripcion.PENDIENTE;
  }

  async update(
    id: string,
    dto: UpdateInscripcionDto,
  ): Promise<InscripcionResponseDto> {
    const inscripcion = await this.findOneEntity(id);

    // Validar que montoBonificado no exceda montoTotal si se actualiza
    if (
      dto.montoBonificado !== undefined &&
      dto.montoBonificado > Number(inscripcion.montoTotal)
    ) {
      throw new BadRequestException(
        'El monto bonificado no puede exceder el monto total',
      );
    }

    // Validar que campos de autorización solo se actualicen en SCOUT_ARGENTINA
    const esScoutArgentina =
      inscripcion.tipo === TipoInscripcion.SCOUT_ARGENTINA;
    const tieneAutorizaciones =
      dto.declaracionDeSalud !== undefined ||
      dto.autorizacionDeImagen !== undefined ||
      dto.salidasCercanas !== undefined ||
      dto.autorizacionIngreso !== undefined ||
      dto.certificadoAptitudFisica !== undefined;

    if (tieneAutorizaciones && !esScoutArgentina) {
      throw new BadRequestException(
        'Los campos de autorización solo aplican a inscripciones de Scout Argentina',
      );
    }

    // Actualizar solo los campos proporcionados
    if (dto.montoBonificado !== undefined) {
      inscripcion.montoBonificado = dto.montoBonificado;
    }
    if (esScoutArgentina) {
      if (dto.declaracionDeSalud !== undefined) {
        inscripcion.declaracionDeSalud = dto.declaracionDeSalud;
      }
      if (dto.autorizacionDeImagen !== undefined) {
        inscripcion.autorizacionDeImagen = dto.autorizacionDeImagen;
      }
      if (dto.salidasCercanas !== undefined) {
        inscripcion.salidasCercanas = dto.salidasCercanas;
      }
      if (dto.autorizacionIngreso !== undefined) {
        inscripcion.autorizacionIngreso = dto.autorizacionIngreso;
      }
      if (dto.certificadoAptitudFisica !== undefined) {
        inscripcion.certificadoAptitudFisica = dto.certificadoAptitudFisica;
      }
    }

    await this.inscripcionRepository.save(inscripcion);
    return this.toResponseDto(inscripcion);
  }

  async remove(id: string): Promise<void> {
    const inscripcion = await this.findOneEntity(id);

    // Validar que no tenga movimientos asociados
    const check = await this.deletionValidator.canDeleteInscripcion(id);
    if (!check.canDelete) {
      throw new BadRequestException(check.reason);
    }

    await this.inscripcionRepository.softRemove(inscripcion);
  }

  /**
   * Calcula el total de deuda de todas las inscripciones
   * Suma de saldoPendiente de todas las inscripciones con deuda > 0
   */
  async getTotalDeudaInscripciones(): Promise<{
    total: number;
    cantidad: number;
  }> {
    const result = await this.inscripcionRepository
      .createQueryBuilder('i')
      .select(
        `SUM(GREATEST(0, i.montoTotal - i.montoBonificado - COALESCE(pagos.total_pagado, 0)))`,
        'total',
      )
      .addSelect(
        `COUNT(CASE WHEN i.montoTotal - i.montoBonificado - COALESCE(pagos.total_pagado, 0) > 0 THEN 1 END)`,
        'cantidad',
      )
      .leftJoin(
        (qb) =>
          qb
            .select('m.inscripcion_id', 'inscripcion_id')
            .addSelect('SUM(m.monto)', 'total_pagado')
            .from('movimientos', 'm')
            .where('m."deletedAt" IS NULL')
            .andWhere('m.tipo = :ingreso', { ingreso: 'ingreso' })
            .andWhere('m.inscripcion_id IS NOT NULL')
            .groupBy('m.inscripcion_id'),
        'pagos',
        'pagos.inscripcion_id = i.id',
      )
      .where('i.deletedAt IS NULL')
      .getRawOne<{ total: string | null; cantidad: string }>();

    return {
      total: Number(result?.total ?? 0),
      cantidad: Number(result?.cantidad ?? 0),
    };
  }

  async pagar(
    id: string,
    dto: PagarInscripcionDto,
    registradoPorId?: string,
  ): Promise<InscripcionResponseDto> {
    const inscripcion = await this.findOneEntity(id);

    // Calcular saldo pendiente
    const montoPagadoActual = await this.getMontoPagado(id);
    const montoTotal = Number(inscripcion.montoTotal);
    const montoBonificado = Number(inscripcion.montoBonificado);
    const saldoPendiente = Math.max(
      0,
      montoTotal - montoBonificado - montoPagadoActual,
    );

    // Validar que la inscripción no esté completamente pagada
    if (saldoPendiente === 0) {
      throw new BadRequestException(
        'La inscripción ya está completamente pagada',
      );
    }

    const montoConSaldoPersonal = dto.montoConSaldoPersonal ?? 0;
    const montoTotalPago = dto.montoPagado + montoConSaldoPersonal;

    // Validar que el monto total a pagar no exceda el saldo pendiente
    if (montoTotalPago > saldoPendiente) {
      throw new BadRequestException(
        `El monto total a pagar ($${montoTotalPago}) excede el saldo pendiente ($${saldoPendiente})`,
      );
    }

    // Ejecutar pago en transacción
    return this.dataSource.transaction(async (manager) => {
      const concepto =
        inscripcion.tipo === TipoInscripcion.SCOUT_ARGENTINA
          ? ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA
          : ConceptoMovimiento.INSCRIPCION_GRUPO;

      await this.pagosService.ejecutarPagoConManager(manager, {
        personaId: inscripcion.personaId,
        montoTotal: montoTotalPago,
        montoConSaldoPersonal,
        medioPago: dto.medioPago,
        concepto,
        inscripcionId: inscripcion.id,
        descripcion:
          dto.descripcion ??
          `Pago inscripción ${inscripcion.tipo} ${inscripcion.ano}`,
        registradoPorId,
      });

      return this.toResponseDto(inscripcion);
    });
  }

  /**
   * Get rama category for an inscription (for aggregation)
   * - Protagonistas are categorized by their rama
   * - Educadores ALWAYS go to 'educadores' (regardless of their rama)
   * - PersonaExterna goes to 'educadores'
   */
  private getRamaCategory(
    dto: InscripcionResponseDto,
  ): keyof Omit<DistribucionPorRamaDto, 'total'> {
    const persona = dto.persona;
    if (!persona) {
      return 'educadores'; // Default for missing persona
    }

    // Educadores and PersonaExterna always go to 'educadores'
    if (
      persona.tipo === PersonaType.EDUCADOR ||
      persona.tipo === PersonaType.EXTERNA
    ) {
      return 'educadores';
    }

    // Only Protagonistas are categorized by their rama
    switch (persona.rama) {
      case Rama.MANADA:
        return 'manada';
      case Rama.UNIDAD:
        return 'unidad';
      case Rama.CAMINANTES:
        return 'caminantes';
      case Rama.ROVERS:
        return 'rovers';
      default:
        return 'educadores';
    }
  }

  /**
   * Create empty distribution DTO with all zeros
   */
  private createEmptyDistribucion(): DistribucionPorRamaDto {
    return {
      total: 0,
      manada: 0,
      unidad: 0,
      caminantes: 0,
      rovers: 0,
      educadores: 0,
    };
  }

  /**
   * Increment distribution counter for a rama category
   */
  private incrementDistribucion(
    dist: DistribucionPorRamaDto,
    rama: keyof Omit<DistribucionPorRamaDto, 'total'>,
  ): void {
    dist[rama]++;
    dist.total++;
  }

  /**
   * Get consolidated statistics for inscriptions
   * Aggregates totals, financials, and debtors by rama
   */
  async getConsolidado(
    query?: GetInscripcionesQueryDto,
  ): Promise<InscripcionesConsolidadoDto> {
    // Get all inscriptions matching basic filters (ano, tipo)
    const where: { ano?: number; tipo?: TipoInscripcion } = {};
    if (query?.ano) {
      where.ano = query.ano;
    }
    if (query?.tipo) {
      where.tipo = query.tipo;
    }

    const inscripciones = await this.inscripcionRepository.find({
      where: Object.keys(where).length > 0 ? where : undefined,
      relations: ['persona'],
      order: { ano: 'DESC', createdAt: 'DESC' },
    });

    let dtos = await this.toResponseDtos(inscripciones);

    // Filtrar por rama o tipo de persona
    if (query?.rama) {
      dtos = this.filterByRamaOrPersonaType(dtos, query.rama);
    }

    // Initialize counters
    const porRama = this.createEmptyDistribucion();
    const financiero = {
      montoEsperado: 0,
      montoPagado: 0,
      montoAdeudado: 0,
      montoBonificado: 0,
    };
    const deudoresDinero = {
      total: 0,
      monto: 0,
      porRama: this.createEmptyDistribucion(),
    };
    const deudoresDocumentacion = {
      total: 0,
      porRama: this.createEmptyDistribucion(),
    };
    const deudoresAmbos = this.createEmptyDistribucion();

    // Process each inscription
    for (const dto of dtos) {
      const rama = this.getRamaCategory(dto);

      // Count by rama
      this.incrementDistribucion(porRama, rama);

      // Financial summary
      financiero.montoEsperado += dto.montoTotal;
      financiero.montoPagado += dto.montoPagado;
      financiero.montoBonificado += dto.montoBonificado;
      financiero.montoAdeudado += dto.saldoPendiente;

      // Debtors analysis
      const hasMoney = this.hasMoneyDebt(dto);
      const hasDocs = this.hasDocumentationDebt(dto);

      if (hasMoney && hasDocs) {
        // Both debts
        this.incrementDistribucion(deudoresAmbos, rama);
        // Also count in individual categories
        deudoresDinero.total++;
        deudoresDinero.monto += dto.saldoPendiente;
        this.incrementDistribucion(deudoresDinero.porRama, rama);
        deudoresDocumentacion.total++;
        this.incrementDistribucion(deudoresDocumentacion.porRama, rama);
      } else if (hasMoney) {
        // Only money debt
        deudoresDinero.total++;
        deudoresDinero.monto += dto.saldoPendiente;
        this.incrementDistribucion(deudoresDinero.porRama, rama);
      } else if (hasDocs) {
        // Only documentation debt
        deudoresDocumentacion.total++;
        this.incrementDistribucion(deudoresDocumentacion.porRama, rama);
      }
    }

    // Apply tipoDeuda filter to results if specified
    // Note: This doesn't change the counts, just what's included in the response
    // The filter is reflected in the 'filtros' field for frontend awareness

    return {
      filtros: {
        ano: query?.ano,
        tipo: query?.tipo,
        tipoDeuda: query?.tipoDeuda,
        rama: query?.rama,
      },
      total: porRama.total,
      porRama,
      financiero,
      deudores: {
        dinero: deudoresDinero,
        documentacion: deudoresDocumentacion,
        ambos: deudoresAmbos,
      },
      fecha: new Date().toISOString(),
    };
  }
}
