import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inscripcion } from './entities/inscripcion.entity';
import { CreateInscripcionDto } from './dtos/create-inscripcion.dto';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import {
  EstadoInscripcion,
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
  PersonaType,
} from '../../common/enums';
import { Protagonista } from '../personas/entities/persona.entity';

@Injectable()
export class InscripcionesService {
  constructor(
    @InjectRepository(Inscripcion)
    private readonly inscripcionRepository: Repository<Inscripcion>,
    private readonly personasService: PersonasService,
    private readonly cajasService: CajasService,
    private readonly movimientosService: MovimientosService,
  ) {}

  async findAll(): Promise<Inscripcion[]> {
    return this.inscripcionRepository.find({
      relations: ['persona'],
      order: { ano: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByPersona(personaId: string): Promise<Inscripcion[]> {
    return this.inscripcionRepository.find({
      where: { personaId },
      order: { ano: 'DESC' },
    });
  }

  async findByAno(ano: number): Promise<Inscripcion[]> {
    return this.inscripcionRepository.find({
      where: { ano },
      relations: ['persona'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Inscripcion> {
    const inscripcion = await this.inscripcionRepository.findOne({
      where: { id },
      relations: ['persona'],
    });

    if (!inscripcion) {
      throw new NotFoundException(`Inscripción con ID ${id} no encontrada`);
    }

    return inscripcion;
  }

  async create(dto: CreateInscripcionDto): Promise<Inscripcion> {
    // Validar que la persona existe
    const persona = await this.personasService.findOne(dto.personaId);

    // Verificar que no exista inscripción para este año
    const existente = await this.inscripcionRepository.findOne({
      where: { personaId: dto.personaId, ano: dto.ano },
    });

    if (existente) {
      throw new BadRequestException(
        `Ya existe una inscripción para esta persona en el año ${dto.ano}`,
      );
    }

    // Calcular bonificación si es protagonista que nunca fue bonificado
    let montoBonificado = 0;
    if (
      persona.tipo === PersonaType.PROTAGONISTA &&
      !(persona as Protagonista).fueBonificado &&
      dto.aplicarBonificacion
    ) {
      montoBonificado = dto.montoTotal;
    }

    const inscripcion = this.inscripcionRepository.create({
      personaId: dto.personaId,
      ano: dto.ano,
      montoTotal: dto.montoTotal,
      montoBonificado,
      montoPagado: 0,
      estado:
        montoBonificado >= dto.montoTotal
          ? EstadoInscripcion.PAGADO
          : EstadoInscripcion.PENDIENTE,
    });

    const saved = await this.inscripcionRepository.save(inscripcion);

    // Si fue bonificado, crear movimiento de bonificación y marcar protagonista
    if (montoBonificado > 0) {
      const cajaGrupo = await this.cajasService.findCajaGrupo();

      const movimiento = await this.movimientosService.create({
        cajaId: cajaGrupo.id,
        tipo: TipoMovimiento.INGRESO,
        monto: montoBonificado,
        concepto: ConceptoMovimiento.AJUSTE_BONIFICACION,
        descripcion: `Bonificación inscripción ${dto.ano} - ${persona.nombre}`,
        responsableId: dto.personaId,
        medioPago: MedioPago.TRANSFERENCIA, // Bonificación no requiere pago real
        estadoPago: EstadoPago.PAGADO,
        inscripcionId: saved.id,
      });

      saved.movimientoBonificacionId = movimiento.id;
      saved.montoPagado = montoBonificado;
      await this.inscripcionRepository.save(saved);

      // Marcar protagonista como bonificado
      await this.personasService.marcarBonificado(dto.personaId);
    }

    return saved;
  }

  async registrarPago(
    inscripcionId: string,
    monto: number,
    medioPago: MedioPago,
    responsableId: string,
  ): Promise<Inscripcion> {
    const inscripcion = await this.findOne(inscripcionId);

    if (inscripcion.estado === EstadoInscripcion.PAGADO) {
      throw new BadRequestException(
        'Esta inscripción ya está completamente pagada',
      );
    }

    const montoRestante =
      inscripcion.montoTotal -
      inscripcion.montoBonificado -
      inscripcion.montoPagado;

    if (monto > montoRestante) {
      throw new BadRequestException(
        `El monto excede el restante a pagar ($${montoRestante})`,
      );
    }

    // Crear movimiento de ingreso en caja grupo
    const cajaGrupo = await this.cajasService.findCajaGrupo();

    await this.movimientosService.create({
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.INGRESO,
      monto,
      concepto: ConceptoMovimiento.INSCRIPCION,
      descripcion: `Pago inscripción ${inscripcion.ano} - ${inscripcion.persona.nombre}`,
      responsableId,
      medioPago,
      estadoPago: EstadoPago.PAGADO,
      inscripcionId,
    });

    // Actualizar inscripción
    inscripcion.montoPagado += monto;

    if (
      inscripcion.montoPagado + inscripcion.montoBonificado >=
      inscripcion.montoTotal
    ) {
      inscripcion.estado = EstadoInscripcion.PAGADO;
    } else {
      inscripcion.estado = EstadoInscripcion.PARCIAL;
    }

    return this.inscripcionRepository.save(inscripcion);
  }

  async registrarPagoScoutArgentina(
    inscripcionId: string,
    monto: number,
    medioPago: MedioPago,
  ): Promise<void> {
    const inscripcion = await this.findOne(inscripcionId);
    const cajaGrupo = await this.cajasService.findCajaGrupo();

    // Crear movimiento de egreso (pago a Scout Argentina)
    await this.movimientosService.create({
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.EGRESO,
      monto,
      concepto: ConceptoMovimiento.INSCRIPCION_PAGO_SCOUT_ARGENTINA,
      descripcion: `Pago a Scout Argentina - Inscripción ${inscripcion.ano}`,
      responsableId: inscripcion.personaId,
      medioPago,
      estadoPago: EstadoPago.PAGADO,
      inscripcionId,
    });
  }

  async remove(id: string): Promise<void> {
    const inscripcion = await this.findOne(id);
    await this.inscripcionRepository.softRemove(inscripcion);
  }
}
