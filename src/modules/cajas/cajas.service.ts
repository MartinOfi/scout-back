import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Caja } from './entities/caja.entity';
import { CreateCajaDto, ConsolidadoSaldosDto } from './dtos';
import { CajaType } from '../../common/enums';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { InscripcionesService } from '../inscripciones/inscripciones.service';
import { CuotasService } from '../cuotas/cuotas.service';
import { CampamentosService } from '../campamentos/campamentos.service';

@Injectable()
export class CajasService {
  constructor(
    @InjectRepository(Caja)
    private readonly cajaRepository: Repository<Caja>,
    private readonly deletionValidator: DeletionValidatorService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
    @Inject(forwardRef(() => InscripcionesService))
    private readonly inscripcionesService: InscripcionesService,
    @Inject(forwardRef(() => CuotasService))
    private readonly cuotasService: CuotasService,
    @Inject(forwardRef(() => CampamentosService))
    private readonly campamentosService: CampamentosService,
  ) {}

  async findAll(): Promise<Caja[]> {
    return this.cajaRepository.find({
      relations: ['propietario'],
      order: { tipo: 'ASC', nombre: 'ASC' },
    });
  }

  async findByTipo(tipo: CajaType): Promise<Caja[]> {
    return this.cajaRepository.find({
      where: { tipo },
      relations: ['propietario'],
    });
  }

  async findOne(id: string): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({
      where: { id },
      relations: ['propietario'],
    });

    if (!caja) {
      throw new NotFoundException(`Caja con ID ${id} no encontrada`);
    }

    return caja;
  }

  async findCajaGrupo(): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({
      where: { tipo: CajaType.GRUPO },
    });

    if (!caja) {
      throw new NotFoundException('Caja del grupo no encontrada');
    }

    return caja;
  }

  async findCajaPersonal(propietarioId: string): Promise<Caja | null> {
    return this.cajaRepository.findOne({
      where: { tipo: CajaType.PERSONAL, propietarioId },
      relations: ['propietario'],
    });
  }

  async create(dto: CreateCajaDto): Promise<Caja> {
    // Validaciones de negocio
    if (dto.tipo === CajaType.GRUPO) {
      const existente = await this.cajaRepository.findOne({
        where: { tipo: CajaType.GRUPO },
      });
      if (existente) {
        throw new BadRequestException('Ya existe una caja de grupo');
      }
    }

    if (dto.tipo === CajaType.PERSONAL && !dto.propietarioId) {
      throw new BadRequestException(
        'Las cajas personales requieren un propietario',
      );
    }

    if (dto.tipo === CajaType.PERSONAL && dto.propietarioId) {
      const existente = await this.findCajaPersonal(dto.propietarioId);
      if (existente) {
        throw new BadRequestException(
          'Esta persona ya tiene una caja personal',
        );
      }
    }

    const caja = this.cajaRepository.create(dto);
    return this.cajaRepository.save(caja);
  }

  async remove(id: string): Promise<void> {
    const caja = await this.findOne(id);

    if (caja.tipo === CajaType.GRUPO) {
      throw new BadRequestException('No se puede eliminar la caja del grupo');
    }

    // Validar que no tenga movimientos asociados
    const check = await this.deletionValidator.canDeleteCaja(id);
    if (!check.canDelete) {
      throw new BadRequestException(check.reason);
    }

    await this.cajaRepository.softRemove(caja);
  }

  async getOrCreateCajaPersonal(
    propietarioId: string,
    nombrePropietario?: string,
  ): Promise<Caja> {
    let caja = await this.findCajaPersonal(propietarioId);

    if (!caja) {
      caja = this.cajaRepository.create({
        tipo: CajaType.PERSONAL,
        propietarioId,
        nombre: nombrePropietario
          ? `Cuenta Personal - ${nombrePropietario}`
          : undefined,
      });
      caja = await this.cajaRepository.save(caja);
    }

    return caja;
  }

  /**
   * Obtiene el consolidado de saldos de todas las cajas y deudas
   */
  async getConsolidadoSaldos(): Promise<ConsolidadoSaldosDto> {
    // Obtener todas las cajas por tipo
    const [cajaGrupo, cajasRama, cajasPersonales] = await Promise.all([
      this.cajaRepository.findOne({ where: { tipo: CajaType.GRUPO } }),
      this.cajaRepository.find({
        where: [
          { tipo: CajaType.RAMA_MANADA },
          { tipo: CajaType.RAMA_UNIDAD },
          { tipo: CajaType.RAMA_CAMINANTES },
          { tipo: CajaType.RAMA_ROVERS },
        ],
        order: { tipo: 'ASC' },
      }),
      this.cajaRepository.find({
        where: { tipo: CajaType.PERSONAL },
      }),
    ]);

    // Calcular saldos en paralelo
    const saldoGrupoPromise = cajaGrupo
      ? this.movimientosService.calcularSaldo(cajaGrupo.id)
      : Promise.resolve(0);

    const saldosRamaPromises = cajasRama.map(async (caja) => ({
      tipo: caja.tipo,
      id: caja.id,
      nombre: caja.nombre || this.getNombreRama(caja.tipo),
      saldo: await this.movimientosService.calcularSaldo(caja.id),
    }));

    const saldosPersonalesPromises = cajasPersonales.map((caja) =>
      this.movimientosService.calcularSaldo(caja.id),
    );

    // Obtener reembolsos pendientes y deudas
    const [
      saldoGrupo,
      saldosRama,
      saldosPersonales,
      reembolsosPendientes,
      deudaInscripciones,
      deudaCuotas,
      deudaCampamentos,
    ] = await Promise.all([
      saldoGrupoPromise,
      Promise.all(saldosRamaPromises),
      Promise.all(saldosPersonalesPromises),
      this.movimientosService.findReembolsosPendientes(),
      this.inscripcionesService.getTotalDeudaInscripciones(),
      this.cuotasService.getTotalDeudaCuotas(),
      this.campamentosService.getTotalDeudaCampamentos(),
    ]);

    // Calcular totales
    const totalRamas = saldosRama.reduce((sum, r) => sum + r.saldo, 0);
    const totalPersonales = saldosPersonales.reduce((sum, s) => sum + s, 0);
    const totalReembolsos = reembolsosPendientes.reduce(
      (sum, r) => sum + r.totalPendiente,
      0,
    );
    const totalDeudas =
      deudaInscripciones.total + deudaCuotas.total + deudaCampamentos.total;

    const totalGeneral = saldoGrupo + totalRamas + totalPersonales;
    const totalDisponible = totalGeneral - totalReembolsos;

    return {
      fecha: new Date().toISOString(),
      resumen: {
        totalGeneral,
        totalDisponible,
        totalPorCobrar: totalDeudas,
      },
      cajaGrupo: {
        id: cajaGrupo?.id ?? '',
        saldo: saldoGrupo,
      },
      fondosRama: {
        total: totalRamas,
        detalle: saldosRama,
      },
      cuentasPersonales: {
        total: totalPersonales,
        cantidad: cajasPersonales.length,
      },
      reembolsosPendientes: {
        total: totalReembolsos,
        cantidad: reembolsosPendientes.length,
      },
      deudasTotales: {
        total: totalDeudas,
        inscripciones: deudaInscripciones,
        cuotas: deudaCuotas,
        campamentos: deudaCampamentos,
      },
    };
  }

  private getNombreRama(tipo: CajaType): string {
    const nombres: Record<string, string> = {
      [CajaType.RAMA_MANADA]: 'Fondo Manada',
      [CajaType.RAMA_UNIDAD]: 'Fondo Unidad',
      [CajaType.RAMA_CAMINANTES]: 'Fondo Caminantes',
      [CajaType.RAMA_ROVERS]: 'Fondo Rovers',
    };
    return nombres[tipo] ?? tipo;
  }
}
