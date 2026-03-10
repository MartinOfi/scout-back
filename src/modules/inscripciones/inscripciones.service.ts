import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inscripcion } from './entities/inscripcion.entity';
import { CreateInscripcionDto } from './dtos/create-inscripcion.dto';
import { UpdateInscripcionDto } from './dtos/update-inscripcion.dto';
import {
  InscripcionResponseDto,
  MovimientoInscripcionDto,
} from './dtos/inscripcion-response.dto';
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { CajasService } from '../cajas/cajas.service';
import {
  EstadoInscripcion,
  TipoInscripcion,
  TipoMovimiento,
  ConceptoMovimiento,
  EstadoPago,
} from '../../common/enums';

@Injectable()
export class InscripcionesService {
  constructor(
    @InjectRepository(Inscripcion)
    private readonly inscripcionRepository: Repository<Inscripcion>,
    private readonly personasService: PersonasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
    private readonly cajasService: CajasService,
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

    // Campos de autorización solo aplican a SCOUT_ARGENTINA
    const esScoutArgentina = dto.tipo === TipoInscripcion.SCOUT_ARGENTINA;

    const inscripcion = this.inscripcionRepository.create({
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
    });

    const savedInscripcion = await this.inscripcionRepository.save(inscripcion);

    // Si hay un pago inicial, crear el movimiento automáticamente
    if (montoPagado > 0) {
      const cajaGrupo = await this.cajasService.findCajaGrupo();
      const concepto =
        dto.tipo === TipoInscripcion.SCOUT_ARGENTINA
          ? ConceptoMovimiento.INSCRIPCION_SCOUT_ARGENTINA
          : ConceptoMovimiento.INSCRIPCION_GRUPO;

      await this.movimientosService.create({
        cajaId: cajaGrupo.id,
        tipo: TipoMovimiento.INGRESO,
        monto: montoPagado,
        concepto,
        descripcion: `Pago inscripción ${dto.tipo} ${dto.ano}`,
        responsableId: dto.personaId,
        medioPago: dto.medioPago,
        estadoPago: EstadoPago.PAGADO,
        inscripcionId: savedInscripcion.id,
      });
    }

    // Reload with persona relation for response
    const reloaded = await this.findOneEntity(savedInscripcion.id);
    return this.toResponseDto(reloaded);
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
      dto.autorizacionIngreso !== undefined;

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
    }

    await this.inscripcionRepository.save(inscripcion);
    return this.toResponseDto(inscripcion);
  }

  async remove(id: string): Promise<void> {
    const inscripcion = await this.findOneEntity(id);
    await this.inscripcionRepository.softRemove(inscripcion);
  }
}
