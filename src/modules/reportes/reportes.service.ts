import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Protagonista,
  Educador,
  Persona,
} from '../personas/entities/persona.entity';
import { CampamentoParticipante } from '../campamentos/entities/campamento-participante.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Cuota } from '../cuotas/entities/cuota.entity';
import {
  TipoMovimiento,
  TipoInscripcion,
  EstadoCuota,
  PersonaType,
  ConceptoMovimiento,
  Rama,
} from '../../common/enums';
import { esMayorDeEdad } from '../../common/utils';
import { DeudaQueryDto } from './dtos/deuda-query.dto';
import {
  PersonaDeudaDto,
  CampamentoDeudaDto,
  InscripcionDeudaDto,
  CuotaDeudaDto,
  DocumentacionPersonalDto,
  DocInscripcionDto,
} from './dtos/deuda-consolidada.dto';
import { RAMA_EDUCADORES, TipoDeudaFilter } from './constants/deuda.constants';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Protagonista)
    private readonly protagonistaRepository: Repository<Protagonista>,
    @InjectRepository(Educador)
    private readonly educadorRepository: Repository<Educador>,
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
    const personas = await this.loadPersonas(query);
    if (!personas.length) return [];

    const personaIds = personas.map((p) => p.id);

    const [participaciones, inscripciones, cuotas] = await Promise.all([
      this.loadParticipaciones(personaIds, query.ano),
      this.loadInscripciones(personaIds, query.ano),
      this.loadCuotas(personaIds, query.ano),
    ]);

    const [campPayments, inscPayments] = await Promise.all([
      this.loadCampamentoPayments(personaIds, participaciones),
      this.loadInscripcionPayments(inscripciones),
    ]);

    return personas
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
      .filter((d): d is PersonaDeudaDto => d !== null)
      .filter((d) => this.matchesTipo(d, query.tipo));
  }

  /** Sin tipo indicado, se devuelven todas las deudas. */
  private matchesTipo(deuda: PersonaDeudaDto, tipo?: TipoDeudaFilter): boolean {
    switch (tipo) {
      // Unifica toda la deuda monetaria: campamentos, inscripciones y cuotas.
      case TipoDeudaFilter.DINERO:
        return deuda.deudaTotal > 0;
      case TipoDeudaFilter.CAMPAMENTOS:
        return deuda.campamentos.some((c) => c.saldo > 0);
      case TipoDeudaFilter.INSCRIPCIONES_SCOUT:
        return deuda.inscripcionesScout.some((i) => i.saldo > 0);
      case TipoDeudaFilter.INSCRIPCIONES_GRUPO:
        return deuda.inscripcionesGrupo.some((i) => i.saldo > 0);
      case TipoDeudaFilter.CUOTAS:
        return deuda.cuotas.some((c) => c.saldo > 0);
      case TipoDeudaFilter.DOCUMENTACION:
        return this.hasDocDeuda(deuda);
      default:
        return true;
    }
  }

  /**
   * Papeles pendientes: documentación personal incompleta, documentación de
   * inscripción faltante o autorizaciones de campamento sin entregar.
   */
  private hasDocDeuda(deuda: PersonaDeudaDto): boolean {
    const doc = deuda.documentacionPersonal;
    const personalIncompleta =
      doc !== null &&
      (!doc.dni ||
        !doc.partidaNacimiento ||
        !doc.dniPadres ||
        !doc.carnetObraSocial);

    return (
      personalIncompleta ||
      deuda.documentacionInscripcion.length > 0 ||
      deuda.campamentos.some((c) => !c.autorizacionEntregada)
    );
  }

  /**
   * Carga protagonistas y educadores que pueden tener deuda. Los educadores se
   * incluyen junto a los protagonistas; al filtrar por una rama concreta solo
   * se devuelven los educadores que tengan esa rama asignada, y con el filtro
   * `Educadores` se devuelven todos los educadores sin importar su rama.
   */
  private async loadPersonas(query: DeudaQueryDto): Promise<Persona[]> {
    if (query.rama === RAMA_EDUCADORES) {
      return this.loadEducadores();
    }

    const [protagonistas, educadores] = await Promise.all([
      this.loadProtagonistas(query.rama),
      this.loadEducadores(query.rama),
    ]);
    return [...protagonistas, ...educadores];
  }

  private async loadProtagonistas(rama?: Rama): Promise<Protagonista[]> {
    const qb = this.protagonistaRepository
      .createQueryBuilder('p')
      .where('p.deletedAt IS NULL');

    if (rama) {
      qb.andWhere('p.rama = :rama', { rama });
    }

    return qb.getMany();
  }

  private async loadEducadores(rama?: Rama): Promise<Educador[]> {
    const qb = this.educadorRepository
      .createQueryBuilder('e')
      .where('e.deletedAt IS NULL');

    if (rama) {
      qb.andWhere('e.rama = :rama', { rama });
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
      .andWhere('m.concepto = :concepto', {
        concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
      })
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
      .andWhere('m.concepto != :concepto', {
        concepto: ConceptoMovimiento.BONIFICACION_RECIBIDA,
      })
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
    persona: Persona,
    allParticipaciones: CampamentoParticipante[],
    campPayments: Movimiento[],
    allInscripciones: Inscripcion[],
    inscPayments: Movimiento[],
    allCuotas: Cuota[],
  ): PersonaDeudaDto | null {
    const esEducador = persona.tipo === PersonaType.EDUCADOR;
    const rama = esEducador ? null : (persona as Protagonista).rama;
    const mayorDeEdad = esMayorDeEdad(persona.tipo, rama);

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
    // Los educadores no tienen documentación personal en el modelo (null). Los
    // protagonistas (incluidos Rovers) sí: solo se exime el DNI de los padres a
    // los Rovers (ver buildDocPersonal).
    const documentacionPersonal = esEducador
      ? null
      : this.buildDocPersonal(persona as Protagonista, mayorDeEdad);
    const documentacionInscripcion = this.buildDocInscripcion(
      persona.id,
      allInscripciones,
      mayorDeEdad,
    );

    const deudaTotal =
      campamentos.reduce((s, c) => s + c.saldo, 0) +
      inscripcionesGrupo.reduce((s, i) => s + i.saldo, 0) +
      inscripcionesScout.reduce((s, i) => s + i.saldo, 0) +
      cuotas.reduce((s, c) => s + c.saldo, 0);

    const deuda: PersonaDeudaDto = {
      personaId: persona.id,
      nombre: persona.nombre,
      tipo: persona.tipo,
      rama: esEducador ? RAMA_EDUCADORES : (rama ?? ''),
      esMayorDeEdad: mayorDeEdad,
      deudaTotal,
      campamentos,
      inscripcionesGrupo,
      inscripcionesScout,
      cuotas,
      documentacionPersonal,
      documentacionInscripcion,
    };

    // Sin deuda de plata ni de papeles, la persona no entra al reporte.
    if (deudaTotal <= 0 && !this.hasDocDeuda(deuda)) return null;

    return deuda;
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

        const montoTotal = Number(cp.montoAsignado);
        const montoBonificado = Number(cp.montoBonificado);
        const saldo = Math.max(0, montoTotal - montoBonificado - montoPagado);

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

  private buildDocPersonal(
    persona: Protagonista,
    mayorDeEdad: boolean,
  ): DocumentacionPersonalDto {
    return {
      dni: persona.dni,
      partidaNacimiento: persona.partidaNacimiento,
      // Los mayores de edad (Rovers) no entregan el DNI de los padres.
      dniPadres: mayorDeEdad ? true : persona.dniPadres,
      carnetObraSocial: persona.carnetObraSocial,
    };
  }

  private buildDocInscripcion(
    personaId: string,
    inscripciones: Inscripcion[],
    exentoPapeles: boolean,
  ): DocInscripcionDto[] {
    return inscripciones
      .filter(
        (i) =>
          i.personaId === personaId &&
          i.tipo === TipoInscripcion.SCOUT_ARGENTINA,
      )
      .map((i) => ({
        inscripcionId: i.id,
        ano: i.ano,
        declaracionDeSalud: i.declaracionDeSalud,
        // Imagen, ingreso y salidas cercanas no se exigen a mayores de edad:
        // se reportan como entregados para que no generen deuda.
        autorizacionDeImagen: exentoPapeles ? true : i.autorizacionDeImagen,
        salidasCercanas: exentoPapeles ? true : i.salidasCercanas,
        autorizacionIngreso: exentoPapeles ? true : i.autorizacionIngreso,
        certificadoAptitudFisica: i.certificadoAptitudFisica,
      }))
      .filter(
        (d) =>
          !d.declaracionDeSalud ||
          !d.autorizacionDeImagen ||
          !d.salidasCercanas ||
          !d.autorizacionIngreso ||
          !d.certificadoAptitudFisica,
      );
  }
}
