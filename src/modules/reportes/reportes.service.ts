import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Protagonista } from '../personas/entities/persona.entity';
import { CampamentoParticipante } from '../campamentos/entities/campamento-participante.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Cuota } from '../cuotas/entities/cuota.entity';
import {
  TipoMovimiento,
  TipoInscripcion,
  EstadoCuota,
} from '../../common/enums';
import { DeudaQueryDto } from './dtos/deuda-query.dto';
import {
  PersonaDeudaDto,
  CampamentoDeudaDto,
  InscripcionDeudaDto,
  CuotaDeudaDto,
  DocumentacionPersonalDto,
  DocInscripcionDto,
} from './dtos/deuda-consolidada.dto';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Protagonista)
    private readonly protagonistaRepository: Repository<Protagonista>,
    @InjectRepository(CampamentoParticipante)
    private readonly participanteRepository: Repository<CampamentoParticipante>,
    @InjectRepository(Movimiento)
    private readonly movimientoRepository: Repository<Movimiento>,
    @InjectRepository(Inscripcion)
    private readonly inscripcionRepository: Repository<Inscripcion>,
    @InjectRepository(Cuota)
    private readonly cuotaRepository: Repository<Cuota>,
  ) {}

  async getDeudas(query: DeudaQueryDto): Promise<PersonaDeudaDto[]> {
    const protagonistas = await this.loadProtagonistas(query);
    if (!protagonistas.length) return [];

    const personaIds = protagonistas.map((p) => p.id);

    const [participaciones, inscripciones, cuotas] = await Promise.all([
      this.loadParticipaciones(personaIds, query.ano),
      this.loadInscripciones(personaIds, query.ano),
      this.loadCuotas(personaIds, query.ano),
    ]);

    const [campPayments, inscPayments] = await Promise.all([
      this.loadCampamentoPayments(personaIds, participaciones),
      this.loadInscripcionPayments(inscripciones),
    ]);

    return protagonistas
      .map((p) =>
        this.buildPersonaDeuda(
          p,
          participaciones,
          campPayments,
          inscripciones,
          inscPayments,
          cuotas,
        ),
      )
      .filter((d): d is PersonaDeudaDto => d !== null);
  }

  private async loadProtagonistas(
    query: DeudaQueryDto,
  ): Promise<Protagonista[]> {
    const qb = this.protagonistaRepository
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL');

    if (query.rama) {
      qb.andWhere('p.rama = :rama', { rama: query.rama });
    }

    return qb.getMany();
  }

  private async loadParticipaciones(
    personaIds: string[],
    ano?: number,
  ): Promise<CampamentoParticipante[]> {
    const participaciones = await this.participanteRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.campamento', 'c')
      .where('cp.personaId IN (:...ids)', { ids: personaIds })
      .andWhere('cp.deletedAt IS NULL')
      .andWhere('c.deletedAt IS NULL')
      .getMany();

    if (!ano) return participaciones;

    return participaciones.filter(
      (cp) => new Date(cp.campamento.fechaInicio).getFullYear() === ano,
    );
  }

  private async loadCampamentoPayments(
    personaIds: string[],
    participaciones: CampamentoParticipante[],
  ): Promise<Movimiento[]> {
    const campIds = [...new Set(participaciones.map((cp) => cp.campamentoId))];
    if (!campIds.length) return [];

    return this.movimientoRepository
      .createQueryBuilder('m')
      .where('m.campamentoId IN (:...campIds)', { campIds })
      .andWhere('m.responsableId IN (:...personaIds)', { personaIds })
      .andWhere('m.tipo = :tipo', { tipo: TipoMovimiento.INGRESO })
      .andWhere('m.deletedAt IS NULL')
      .getMany();
  }

  private async loadInscripciones(
    personaIds: string[],
    ano?: number,
  ): Promise<Inscripcion[]> {
    const qb = this.inscripcionRepository
      .createQueryBuilder('i')
      .where('i.personaId IN (:...ids)', { ids: personaIds })
      .andWhere('i.deletedAt IS NULL');

    if (ano) {
      qb.andWhere('i.ano = :ano', { ano });
    }

    return qb.getMany();
  }

  private async loadInscripcionPayments(
    inscripciones: Inscripcion[],
  ): Promise<Movimiento[]> {
    const inscIds = inscripciones.map((i) => i.id);
    if (!inscIds.length) return [];

    return this.movimientoRepository
      .createQueryBuilder('m')
      .where('m.inscripcionId IN (:...inscIds)', { inscIds })
      .andWhere('m.tipo = :tipo', { tipo: TipoMovimiento.INGRESO })
      .andWhere('m.deletedAt IS NULL')
      .getMany();
  }

  private async loadCuotas(
    personaIds: string[],
    ano?: number,
  ): Promise<Cuota[]> {
    const qb = this.cuotaRepository
      .createQueryBuilder('c')
      .where('c.personaId IN (:...ids)', { ids: personaIds })
      .andWhere('c.deletedAt IS NULL')
      .andWhere('c.estado != :estado', { estado: EstadoCuota.PAGADO });

    if (ano) {
      qb.andWhere('c.ano = :ano', { ano });
    }

    return qb.getMany();
  }

  private buildPersonaDeuda(
    persona: Protagonista,
    allParticipaciones: CampamentoParticipante[],
    campPayments: Movimiento[],
    allInscripciones: Inscripcion[],
    inscPayments: Movimiento[],
    allCuotas: Cuota[],
  ): PersonaDeudaDto | null {
    const campamentos = this.buildCampamentosDeuda(
      persona.id,
      allParticipaciones,
      campPayments,
    );
    const inscripcionesGrupo = this.buildInscripcionesDeuda(
      persona.id,
      allInscripciones,
      inscPayments,
      TipoInscripcion.GRUPO,
    );
    const inscripcionesScout = this.buildInscripcionesDeuda(
      persona.id,
      allInscripciones,
      inscPayments,
      TipoInscripcion.SCOUT_ARGENTINA,
    );
    const cuotas = this.buildCuotasDeuda(persona.id, allCuotas);
    const documentacionPersonal = this.buildDocPersonal(persona);
    const documentacionInscripcion = this.buildDocInscripcion(
      persona.id,
      allInscripciones,
    );

    const deudaTotal =
      campamentos.reduce((s, c) => s + c.saldo, 0) +
      inscripcionesGrupo.reduce((s, i) => s + i.saldo, 0) +
      inscripcionesScout.reduce((s, i) => s + i.saldo, 0) +
      cuotas.reduce((s, c) => s + c.saldo, 0);

    const hasDocDeuda =
      !documentacionPersonal.dni ||
      !documentacionPersonal.partidaNacimiento ||
      !documentacionPersonal.dniPadres ||
      !documentacionPersonal.carnetObraSocial ||
      documentacionInscripcion.length > 0 ||
      campamentos.some((c) => !c.autorizacionEntregada);

    if (deudaTotal <= 0 && !hasDocDeuda) return null;

    return {
      personaId: persona.id,
      nombre: persona.nombre,
      rama: persona.rama,
      deudaTotal,
      campamentos,
      inscripcionesGrupo,
      inscripcionesScout,
      cuotas,
      documentacionPersonal,
      documentacionInscripcion,
    };
  }

  private buildCampamentosDeuda(
    personaId: string,
    participaciones: CampamentoParticipante[],
    campPayments: Movimiento[],
  ): CampamentoDeudaDto[] {
    return participaciones
      .filter((cp) => cp.personaId === personaId)
      .map((cp) => {
        const montoPagado = campPayments
          .filter(
            (m) =>
              m.campamentoId === cp.campamentoId &&
              m.responsableId === personaId,
          )
          .reduce((sum, m) => sum + Number(m.monto), 0);

        const montoTotal = Number(cp.campamento.costoPorPersona);
        const saldo = montoTotal - montoPagado;

        return {
          campamentoId: cp.campamentoId,
          nombre: cp.campamento.nombre,
          ano: new Date(cp.campamento.fechaInicio).getFullYear(),
          montoTotal,
          montoPagado,
          saldo,
          autorizacionEntregada: cp.autorizacionEntregada,
        };
      })
      .filter((c) => c.saldo > 0 || !c.autorizacionEntregada);
  }

  private buildInscripcionesDeuda(
    personaId: string,
    inscripciones: Inscripcion[],
    inscPayments: Movimiento[],
    tipo: TipoInscripcion,
  ): InscripcionDeudaDto[] {
    return inscripciones
      .filter((i) => i.personaId === personaId && i.tipo === tipo)
      .map((i) => {
        const montoPagado = inscPayments
          .filter((m) => m.inscripcionId === i.id)
          .reduce((sum, m) => sum + Number(m.monto), 0);

        const montoTotal = Number(i.montoTotal);
        const montoBonificado = Number(i.montoBonificado);
        const saldo = montoTotal - montoBonificado - montoPagado;

        return {
          inscripcionId: i.id,
          tipo: i.tipo,
          ano: i.ano,
          montoTotal,
          montoBonificado,
          montoPagado,
          saldo,
        };
      })
      .filter((i) => i.saldo > 0);
  }

  private buildCuotasDeuda(
    personaId: string,
    cuotas: Cuota[],
  ): CuotaDeudaDto[] {
    return cuotas
      .filter((c) => c.personaId === personaId)
      .map((c) => ({
        cuotaId: c.id,
        nombre: c.nombre,
        ano: c.ano,
        montoTotal: Number(c.montoTotal),
        montoPagado: Number(c.montoPagado),
        saldo: Number(c.montoTotal) - Number(c.montoPagado),
      }));
  }

  private buildDocPersonal(persona: Protagonista): DocumentacionPersonalDto {
    return {
      dni: persona.dni,
      partidaNacimiento: persona.partidaNacimiento,
      dniPadres: persona.dniPadres,
      carnetObraSocial: persona.carnetObraSocial,
    };
  }

  private buildDocInscripcion(
    personaId: string,
    inscripciones: Inscripcion[],
  ): DocInscripcionDto[] {
    return inscripciones
      .filter(
        (i) =>
          i.personaId === personaId &&
          i.tipo === TipoInscripcion.SCOUT_ARGENTINA &&
          (!i.declaracionDeSalud ||
            !i.autorizacionDeImagen ||
            !i.salidasCercanas ||
            !i.autorizacionIngreso ||
            !i.certificadoAptitudFisica),
      )
      .map((i) => ({
        inscripcionId: i.id,
        ano: i.ano,
        declaracionDeSalud: i.declaracionDeSalud,
        autorizacionDeImagen: i.autorizacionDeImagen,
        salidasCercanas: i.salidasCercanas,
        autorizacionIngreso: i.autorizacionIngreso,
        certificadoAptitudFisica: i.certificadoAptitudFisica,
      }));
  }
}
