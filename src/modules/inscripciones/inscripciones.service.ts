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
import { PersonasService } from '../personas/personas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import {
  EstadoInscripcion,
  TipoInscripcion,
  TipoMovimiento,
} from '../../common/enums';

@Injectable()
export class InscripcionesService {
  constructor(
    @InjectRepository(Inscripcion)
    private readonly inscripcionRepository: Repository<Inscripcion>,
    private readonly personasService: PersonasService,
    @Inject(forwardRef(() => MovimientosService))
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

  async findByAno(ano: number, tipo?: TipoInscripcion): Promise<Inscripcion[]> {
    const where: { ano: number; tipo?: TipoInscripcion } = { ano };
    if (tipo) {
      where.tipo = tipo;
    }

    return this.inscripcionRepository.find({
      where,
      relations: ['persona'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByAnoAndTipo(
    ano: number,
    tipo: TipoInscripcion,
  ): Promise<Inscripcion[]> {
    return this.inscripcionRepository.find({
      where: { ano, tipo },
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

  async findOneWithEstado(id: string): Promise<{
    inscripcion: Inscripcion;
    montoPagado: number;
    estado: EstadoInscripcion;
  }> {
    const inscripcion = await this.findOne(id);
    const montoPagado = await this.getMontoPagado(id);
    const estado = await this.getEstado(inscripcion);

    return { inscripcion, montoPagado, estado };
  }

  async registrarInscripcion(dto: CreateInscripcionDto): Promise<Inscripcion> {
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

    const inscripcion = this.inscripcionRepository.create({
      personaId: dto.personaId,
      tipo: dto.tipo,
      ano: dto.ano,
      montoTotal: dto.montoTotal,
      montoBonificado,
    });

    return this.inscripcionRepository.save(inscripcion);
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

  async remove(id: string): Promise<void> {
    const inscripcion = await this.findOne(id);
    await this.inscripcionRepository.softRemove(inscripcion);
  }
}
