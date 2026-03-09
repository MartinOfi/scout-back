import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cuota } from './entities/cuota.entity';
import { CreateCuotaDto } from './dtos/create-cuota.dto';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import {
  EstadoCuota,
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
} from '../../common/enums';

@Injectable()
export class CuotasService {
  constructor(
    @InjectRepository(Cuota)
    private readonly cuotaRepository: Repository<Cuota>,
    private readonly personasService: PersonasService,
    private readonly cajasService: CajasService,
    private readonly movimientosService: MovimientosService,
  ) {}

  async findAll(): Promise<Cuota[]> {
    return this.cuotaRepository.find({
      relations: ['persona'],
      order: { ano: 'DESC', nombre: 'ASC' },
    });
  }

  async findByPersona(personaId: string): Promise<Cuota[]> {
    return this.cuotaRepository.find({
      where: { personaId },
      order: { ano: 'DESC', nombre: 'ASC' },
    });
  }

  async findByAno(ano: number): Promise<Cuota[]> {
    return this.cuotaRepository.find({
      where: { ano },
      relations: ['persona'],
      order: { nombre: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Cuota> {
    const cuota = await this.cuotaRepository.findOne({
      where: { id },
      relations: ['persona'],
    });

    if (!cuota) {
      throw new NotFoundException(`Cuota con ID ${id} no encontrada`);
    }

    return cuota;
  }

  async create(dto: CreateCuotaDto): Promise<Cuota> {
    // Validar que la persona existe
    await this.personasService.findOne(dto.personaId);

    const cuota = this.cuotaRepository.create({
      ...dto,
      montoPagado: 0,
      estado: EstadoCuota.PENDIENTE,
    });

    return this.cuotaRepository.save(cuota);
  }

  async registrarPago(
    cuotaId: string,
    monto: number,
    medioPago: MedioPago,
    responsableId: string,
  ): Promise<Cuota> {
    const cuota = await this.findOne(cuotaId);

    if (cuota.estado === EstadoCuota.PAGADO) {
      throw new BadRequestException('Esta cuota ya está completamente pagada');
    }

    const montoRestante = cuota.montoTotal - cuota.montoPagado;

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
      concepto: ConceptoMovimiento.CUOTA_GRUPO,
      descripcion: `Pago cuota "${cuota.nombre}" - ${cuota.persona.nombre}`,
      responsableId,
      medioPago,
      estadoPago: EstadoPago.PAGADO,
      cuotaId,
    });

    // Actualizar cuota
    cuota.montoPagado += monto;

    if (cuota.montoPagado >= cuota.montoTotal) {
      cuota.estado = EstadoCuota.PAGADO;
    } else {
      cuota.estado = EstadoCuota.PARCIAL;
    }

    return this.cuotaRepository.save(cuota);
  }

  async remove(id: string): Promise<void> {
    const cuota = await this.findOne(id);
    await this.cuotaRepository.softRemove(cuota);
  }
}
