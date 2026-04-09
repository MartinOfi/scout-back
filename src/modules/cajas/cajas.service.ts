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
import { CreateCajaDto, ConsolidadoSaldosDto, CajaResponseDto } from './dtos';
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

  async findAll(): Promise<CajaResponseDto[]> {
    const cajas = await this.cajaRepository.find({
      relations: ['propietario'],
      order: { tipo: 'ASC', nombre: 'ASC' },
    });

    return this.mapCajasWithSaldo(cajas);
  }

  async findByTipo(tipo: CajaType): Promise<CajaResponseDto[]> {
    const cajas = await this.cajaRepository.find({
      where: { tipo },
      relations: ['propietario'],
    });

    return this.mapCajasWithSaldo(cajas);
  }

  async findOne(id: string): Promise<CajaResponseDto> {
    const caja = await this.findOneEntity(id);
    const saldo = await this.movimientosService.calcularSaldo(caja.id);
    return this.mapCajaToResponse(caja, saldo);
  }

  /**
   * Internal method to find a Caja entity by ID
   * Use this for internal operations that need the entity (not the DTO)
   */
  private async findOneEntity(id: string): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({
      where: { id },
      relations: ['propietario'],
    });

    if (!caja) {
      throw new NotFoundException(`Caja con ID ${id} no encontrada`);
    }

    return caja;
  }

  /**
   * Maps an array of Caja entities to CajaResponseDto with calculated saldo
   */
  private async mapCajasWithSaldo(cajas: Caja[]): Promise<CajaResponseDto[]> {
    if (cajas.length === 0) return [];
    const cajaIds = cajas.map((caja) => caja.id);
    const saldoMap = await this.movimientosService.calcularSaldosBatch(cajaIds);
    return cajas.map((caja) =>
      this.mapCajaToResponse(caja, saldoMap.get(caja.id) ?? 0),
    );
  }

  /**
   * Maps a single Caja entity to CajaResponseDto
   */
  private mapCajaToResponse(caja: Caja, saldo: number): CajaResponseDto {
    return {
      id: caja.id,
      tipo: caja.tipo,
      nombre: caja.nombre,
      propietarioId: caja.propietarioId,
      propietario: caja.propietario
        ? {
            id: caja.propietario.id,
            nombre: caja.propietario.nombre,
          }
        : null,
      saldoActual: saldo,
      createdAt: caja.createdAt,
      updatedAt: caja.updatedAt,
    };
  }

  async findCajaGrupo(): Promise<CajaResponseDto> {
    const caja = await this.cajaRepository.findOne({
      where: { tipo: CajaType.GRUPO },
    });

    if (!caja) {
      throw new NotFoundException('Caja del grupo no encontrada');
    }

    const saldo = await this.movimientosService.calcularSaldo(caja.id);
    return this.mapCajaToResponse(caja, saldo);
  }

  async findCajaPersonal(propietarioId: string): Promise<Caja | null> {
    return this.cajaRepository.findOne({
      where: { tipo: CajaType.PERSONAL, propietarioId },
      relations: ['propietario'],
    });
  }

  /**
   * Obtiene el saldo de la cuenta personal de una persona
   * Retorna 0 si la persona no tiene cuenta personal
   */
  async getSaldoCuentaPersonal(personaId: string): Promise<number> {
    const caja = await this.findCajaPersonal(personaId);
    if (!caja) {
      return 0;
    }
    return this.movimientosService.calcularSaldo(caja.id);
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
    const caja = await this.findOneEntity(id);

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

    // Collect all caja IDs for a single batch saldo query
    const allCajaIds = [
      ...(cajaGrupo ? [cajaGrupo.id] : []),
      ...cajasRama.map((c) => c.id),
      ...cajasPersonales.map((c) => c.id),
    ];

    const [
      saldoMap,
      reembolsosPendientes,
      deudaInscripciones,
      deudaCuotas,
      deudaCampamentos,
    ] = await Promise.all([
      allCajaIds.length > 0
        ? this.movimientosService.calcularSaldosBatch(allCajaIds)
        : Promise.resolve(new Map<string, number>()),
      this.movimientosService.findReembolsosPendientes(),
      this.inscripcionesService.getTotalDeudaInscripciones(),
      this.cuotasService.getTotalDeudaCuotas(),
      this.campamentosService.getTotalDeudaCampamentos(),
    ]);

    const saldoGrupo = cajaGrupo ? (saldoMap.get(cajaGrupo.id) ?? 0) : 0;

    const saldosRama = cajasRama.map((caja) => ({
      tipo: caja.tipo,
      id: caja.id,
      nombre: caja.nombre || this.getNombreRama(caja.tipo),
      saldo: saldoMap.get(caja.id) ?? 0,
    }));

    const saldosPersonales = cajasPersonales.map(
      (caja) => saldoMap.get(caja.id) ?? 0,
    );

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
