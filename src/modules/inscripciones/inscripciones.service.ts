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
import {
  InscripcionResponseDto,
  MovimientoInscripcionDto,
} from './dtos/inscripcion-response.dto';
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { PagosService } from '../pagos/pagos.service';
import {
  EstadoInscripcion,
  TipoInscripcion,
  TipoMovimiento,
  ConceptoMovimiento,
} from '../../common/enums';

@Injectable()
export class InscripcionesService {
  constructor(
    @InjectRepository(Inscripcion)
    private readonly inscripcionRepository: Repository<Inscripcion>,
    private readonly personasService: PersonasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
    @Inject(forwardRef(() => PagosService))
    private readonly pagosService: PagosService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Transforma una inscripción a DTO con campos calculados
   */
  private async toResponseDto(
    inscripcion: Inscripcion,
  ): Promise<InscripcionResponseDto> {
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'inscripcion',
      inscripcion.id,
    );

    const movimientosDto: MovimientoInscripcionDto[] = movimientos
      .filter((m) => m.tipo === TipoMovimiento.INGRESO)
      .map((m) => ({
        id: m.id,
        monto: Number(m.monto),
        medioPago: m.medioPago,
        fecha: m.fecha,
        descripcion: m.descripcion,
      }));

    const montoPagado = movimientosDto.reduce((sum, m) => sum + m.monto, 0);
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
          }
        : undefined,
      movimientos: movimientosDto,
    };
  }

  /**
   * Transforma múltiples inscripciones a DTOs
   */
  private async toResponseDtos(
    inscripciones: Inscripcion[],
  ): Promise<InscripcionResponseDto[]> {
    return Promise.all(inscripciones.map((i) => this.toResponseDto(i)));
  }

  async findAll(): Promise<InscripcionResponseDto[]> {
    const inscripciones = await this.inscripcionRepository.find({
      relations: ['persona'],
      order: { ano: 'DESC', createdAt: 'DESC' },
    });
    return this.toResponseDtos(inscripciones);
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

    // Validar que montoConSaldoPersonal <= montoPagado
    if (montoConSaldoPersonal > montoPagado) {
      throw new BadRequestException(
        'El monto de saldo personal no puede superar el monto pagado',
      );
    }

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

      // Si hay un pago inicial, usar PagosService
      if (montoPagado > 0) {
        const concepto =
          dto.tipo === TipoInscripcion.SCOUT_ARGENTINA
            ? ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA
            : ConceptoMovimiento.INSCRIPCION_GRUPO;

        await this.pagosService.ejecutarPagoConManager(manager, {
          personaId: dto.personaId,
          montoTotal: montoPagado,
          montoConSaldoPersonal,
          medioPago: dto.medioPago,
          concepto,
          inscripcionId: savedInscripcion.id,
          descripcion: `Pago inscripción ${dto.tipo} ${dto.ano}`,
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
    await this.inscripcionRepository.softRemove(inscripcion);
  }

  async pagar(
    id: string,
    dto: PagarInscripcionDto,
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

    // Validar que el monto a pagar no exceda el saldo pendiente
    if (dto.montoPagado > saldoPendiente) {
      throw new BadRequestException(
        `El monto a pagar ($${dto.montoPagado}) excede el saldo pendiente ($${saldoPendiente})`,
      );
    }

    const montoConSaldoPersonal = dto.montoConSaldoPersonal ?? 0;

    // Validar que montoConSaldoPersonal <= montoPagado
    if (montoConSaldoPersonal > dto.montoPagado) {
      throw new BadRequestException(
        'El monto de saldo personal no puede superar el monto a pagar',
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
        montoTotal: dto.montoPagado,
        montoConSaldoPersonal,
        medioPago: dto.medioPago,
        concepto,
        inscripcionId: inscripcion.id,
        descripcion:
          dto.descripcion ??
          `Pago inscripción ${inscripcion.tipo} ${inscripcion.ano}`,
      });

      return this.toResponseDto(inscripcion);
    });
  }
}
