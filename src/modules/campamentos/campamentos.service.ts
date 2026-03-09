import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campamento } from './entities/campamento.entity';
import { CreateCampamentoDto } from './dtos/create-campamento.dto';
import { UpdateCampamentoDto } from './dtos/update-campamento.dto';
import { AddParticipanteDto } from './dtos/add-participante.dto';
import { PersonasService } from '../personas/personas.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
} from '../../common/enums';

@Injectable()
export class CampamentosService {
  constructor(
    @InjectRepository(Campamento)
    private readonly campamentoRepository: Repository<Campamento>,
    private readonly personasService: PersonasService,
    private readonly cajasService: CajasService,
    private readonly movimientosService: MovimientosService,
  ) {}

  async findAll(): Promise<Campamento[]> {
    return this.campamentoRepository.find({
      relations: ['participantes'],
      order: { fechaInicio: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Campamento> {
    const campamento = await this.campamentoRepository.findOne({
      where: { id },
      relations: ['participantes'],
    });

    if (!campamento) {
      throw new NotFoundException(`Campamento con ID ${id} no encontrado`);
    }

    return campamento;
  }

  async create(dto: CreateCampamentoDto): Promise<Campamento> {
    const campamento = this.campamentoRepository.create({
      ...dto,
      participantes: [],
    });

    return this.campamentoRepository.save(campamento);
  }

  async update(id: string, dto: UpdateCampamentoDto): Promise<Campamento> {
    const campamento = await this.findOne(id);
    Object.assign(campamento, dto);
    return this.campamentoRepository.save(campamento);
  }

  async addParticipante(
    id: string,
    dto: AddParticipanteDto,
  ): Promise<Campamento> {
    const campamento = await this.findOne(id);
    const persona = await this.personasService.findOne(dto.personaId);

    // Verificar que no esté ya agregado
    const yaEstaAgregado = campamento.participantes.some(
      (p) => p.id === dto.personaId,
    );

    if (yaEstaAgregado) {
      throw new BadRequestException(
        'Esta persona ya está inscrita en el campamento',
      );
    }

    campamento.participantes.push(persona);
    return this.campamentoRepository.save(campamento);
  }

  async removeParticipante(id: string, personaId: string): Promise<Campamento> {
    const campamento = await this.findOne(id);

    campamento.participantes = campamento.participantes.filter(
      (p) => p.id !== personaId,
    );

    return this.campamentoRepository.save(campamento);
  }

  async registrarPago(
    campamentoId: string,
    personaId: string,
    monto: number,
    medioPago: MedioPago,
  ): Promise<void> {
    const campamento = await this.findOne(campamentoId);
    await this.personasService.findOne(personaId);

    const cajaGrupo = await this.cajasService.findCajaGrupo();

    await this.movimientosService.create({
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.INGRESO,
      monto,
      concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
      descripcion: `Pago campamento "${campamento.nombre}"`,
      responsableId: personaId,
      medioPago,
      estadoPago: EstadoPago.PAGADO,
      campamentoId,
    });
  }

  async registrarGasto(
    campamentoId: string,
    monto: number,
    descripcion: string,
    responsableId: string,
    medioPago: MedioPago,
    estadoPago: EstadoPago,
    personaAReembolsarId?: string,
  ): Promise<void> {
    const campamento = await this.findOne(campamentoId);
    await this.personasService.findOne(responsableId);

    const cajaGrupo = await this.cajasService.findCajaGrupo();

    await this.movimientosService.create({
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.EGRESO,
      monto,
      concepto: ConceptoMovimiento.CAMPAMENTO_GASTO,
      descripcion: `${descripcion} - Campamento "${campamento.nombre}"`,
      responsableId,
      medioPago,
      estadoPago,
      personaAReembolsarId,
      campamentoId,
    });
  }

  async getResumenFinanciero(campamentoId: string): Promise<{
    totalEsperado: number;
    totalRecaudado: number;
    totalGastado: number;
    saldo: number;
    participantes: number;
  }> {
    const campamento = await this.findOne(campamentoId);
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'campamento',
      campamentoId,
    );

    const totalRecaudado = movimientos
      .filter((m) => m.tipo === TipoMovimiento.INGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const totalGastado = movimientos
      .filter((m) => m.tipo === TipoMovimiento.EGRESO)
      .reduce((sum, m) => sum + Number(m.monto), 0);

    return {
      totalEsperado:
        campamento.participantes.length * Number(campamento.costoPorPersona),
      totalRecaudado,
      totalGastado,
      saldo: totalRecaudado - totalGastado,
      participantes: campamento.participantes.length,
    };
  }

  /**
   * Obtiene el seguimiento de pagos por participante
   * PRD F4: Control de pagos por participante en campamentos
   */
  async getPagosPorParticipante(campamentoId: string): Promise<
    {
      participanteId: string;
      participanteNombre: string;
      costoPorPersona: number;
      totalPagado: number;
      saldoPendiente: number;
      pagos: { fecha: Date; monto: number; medioPago: string }[];
    }[]
  > {
    const campamento = await this.findOne(campamentoId);
    const movimientos = await this.movimientosService.findByRelatedEntity(
      'campamento',
      campamentoId,
    );

    // Filtrar solo pagos (ingresos con concepto CAMPAMENTO_PAGO)
    const pagos = movimientos.filter(
      (m) =>
        m.tipo === TipoMovimiento.INGRESO &&
        m.concepto === ConceptoMovimiento.CAMPAMENTO_PAGO,
    );

    // Agrupar por responsableId (participante que pagó)
    const pagosPorParticipante = new Map<
      string,
      {
        totalPagado: number;
        pagos: { fecha: Date; monto: number; medioPago: string }[];
      }
    >();

    for (const pago of pagos) {
      const current = pagosPorParticipante.get(pago.responsableId) || {
        totalPagado: 0,
        pagos: [],
      };

      current.totalPagado += Number(pago.monto);
      current.pagos.push({
        fecha: pago.fecha,
        monto: Number(pago.monto),
        medioPago: pago.medioPago,
      });

      pagosPorParticipante.set(pago.responsableId, current);
    }

    const costoPorPersona = Number(campamento.costoPorPersona);

    // Construir respuesta con todos los participantes
    return campamento.participantes.map((participante) => {
      const datosPago = pagosPorParticipante.get(participante.id) || {
        totalPagado: 0,
        pagos: [],
      };

      return {
        participanteId: participante.id,
        participanteNombre: participante.nombre,
        costoPorPersona,
        totalPagado: datosPago.totalPagado,
        saldoPendiente: costoPorPersona - datosPago.totalPagado,
        pagos: datosPago.pagos.sort(
          (a, b) => b.fecha.getTime() - a.fecha.getTime(),
        ),
      };
    });
  }

  async remove(id: string): Promise<void> {
    const campamento = await this.findOne(id);
    await this.campamentoRepository.softRemove(campamento);
  }
}
