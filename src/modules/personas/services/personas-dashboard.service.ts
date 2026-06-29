// src/modules/personas/services/personas-dashboard.service.ts
import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonasService } from '../personas.service';
import { CajasService } from '../../cajas/cajas.service';
import { InscripcionesService } from '../../inscripciones/inscripciones.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { Movimiento } from '../../movimientos/entities/movimiento.entity';
import { CampamentoParticipante } from '../../campamentos/entities/campamento-participante.entity';
import { Persona, Protagonista, Educador } from '../entities/persona.entity';
import { InscripcionResponseDto } from '../../inscripciones/dtos/inscripcion-response.dto';
import {
  PersonaDashboardDto,
  InscripcionDashboardItemDto,
  CampamentoDashboardItemDto,
  DocumentacionPersonalDto,
  MovimientoDashboardDto,
  AutorizacionesInscripcionDto,
} from '../dtos/persona-dashboard.dto';
import {
  PersonaType,
  Rama,
  TipoInscripcion,
  TipoMovimiento,
  ConceptoMovimiento,
} from '../../../common/enums';
import { esMayorDeEdad } from '../../../common/utils';

/**
 * Conceptos que NO se muestran en "últimos movimientos" del dashboard de persona:
 * son contabilidad interna del grupo, no actividad financiera de la persona.
 */
const CONCEPTOS_OCULTOS_DASHBOARD: ReadonlySet<ConceptoMovimiento> = new Set([
  ConceptoMovimiento.EVENTO_VENTA_RECUPERO_COSTO,
]);

@Injectable()
export class PersonasDashboardService {
  constructor(
    @Inject(forwardRef(() => PersonasService))
    private readonly personasService: PersonasService,
    @Inject(forwardRef(() => CajasService))
    private readonly cajasService: CajasService,
    @Inject(forwardRef(() => InscripcionesService))
    private readonly inscripcionesService: InscripcionesService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
    @InjectRepository(CampamentoParticipante)
    private readonly participanteRepository: Repository<CampamentoParticipante>,
  ) {}

  async getDashboard(personaId: string): Promise<PersonaDashboardDto> {
    // 1. Get persona and validate type
    const persona = await this.personasService.findOne(personaId);

    // Check for PersonaExterna - use the correct enum name from the codebase
    if (persona.tipo === PersonaType.EXTERNA) {
      throw new BadRequestException(
        'Dashboard no disponible para PersonaExterna',
      );
    }

    // 2. Get or create personal account
    const cajaPersonal =
      await this.cajasService.getOrCreateCajaPersonal(personaId);

    // 3. Parallel data fetching
    //
    // A persona's movements live in two places: payments (inscripciones, cuotas,
    // recupero de ventas) are recorded in the caja grupo with responsableId =
    // persona, while uso de saldo personal / ajustes / ganancia de ventas land in
    // the caja personal. Querying only the caja personal misses most activity, so
    // we merge both sources keyed by responsable and by caja personal.
    const [
      saldo,
      inscripciones,
      participaciones,
      movimientosResponsable,
      movimientosCaja,
    ] = await Promise.all([
      this.movimientosService.calcularSaldo(cajaPersonal.id),
      this.inscripcionesService.findByPersona(personaId),
      this.loadParticipaciones(personaId),
      this.movimientosService.findByResponsable(personaId),
      this.movimientosService.findByCaja(cajaPersonal.id),
    ]);

    const movimientos = this.mergeMovimientosByFecha(
      movimientosResponsable,
      movimientosCaja,
    );

    const currentYear = new Date().getFullYear();
    const rama = this.getRama(persona);
    const mayorDeEdad = esMayorDeEdad(persona.tipo, rama);

    const inscripcionItems = this.buildInscripcionItems(
      inscripciones,
      currentYear,
      mayorDeEdad,
    );
    const campamentoItems = this.buildCampamentoItems(
      participaciones,
      movimientosResponsable,
      currentYear,
    );
    const documentacionPersonal = this.buildDocumentacionPersonal(
      persona,
      mayorDeEdad,
    );

    const deudaInscripciones = inscripcionItems.reduce(
      (sum, i) => sum + i.saldoPendiente,
      0,
    );
    const deudaCampamentos = campamentoItems.reduce(
      (sum, c) => sum + Math.max(c.saldoPendiente, 0),
      0,
    );

    return {
      persona: {
        id: persona.id,
        nombre: persona.nombre,
        tipo: persona.tipo,
        estado: persona.estado,
        rama,
        cargo:
          persona.tipo === PersonaType.EDUCADOR
            ? (persona as Educador).cargo
            : undefined,
      },
      cuentaPersonal: {
        id: cajaPersonal.id,
        saldo,
      },
      documentacionPersonal,
      inscripciones: {
        resumen: {
          total: deudaInscripciones,
          cantidad: inscripcionItems.filter((i) => i.saldoPendiente > 0).length,
        },
        items: inscripcionItems,
      },
      campamentos: {
        resumen: {
          total: deudaCampamentos,
          cantidad: campamentoItems.filter((c) => c.saldoPendiente > 0).length,
        },
        items: campamentoItems,
      },
      deudaTotal: {
        total: deudaInscripciones + deudaCampamentos,
        inscripciones: deudaInscripciones,
        campamentos: deudaCampamentos,
      },
      ultimosMovimientos: this.buildMovimientos(movimientos),
    };
  }

  /** Rama de la persona (null para externos o tipos sin rama). */
  private getRama(persona: Persona): Rama | null {
    if (persona.tipo === PersonaType.PROTAGONISTA) {
      return (persona as Protagonista).rama;
    }
    if (persona.tipo === PersonaType.EDUCADOR) {
      return (persona as Educador).rama;
    }
    return null;
  }

  /**
   * Inscripciones del año actual + años pasados con deuda. Para mayores de edad
   * se reportan imagen/ingreso/salidas como entregadas (no generan deuda).
   */
  private buildInscripcionItems(
    inscripciones: InscripcionResponseDto[],
    currentYear: number,
    mayorDeEdad: boolean,
  ): InscripcionDashboardItemDto[] {
    return inscripciones
      .filter((i) => i.ano === currentYear || i.saldoPendiente > 0)
      .map((i) => {
        const item: InscripcionDashboardItemDto = {
          id: i.id,
          tipo: i.tipo,
          ano: i.ano,
          montoTotal: i.montoTotal,
          montoBonificado: i.montoBonificado,
          montoPagado: i.montoPagado,
          saldoPendiente: i.saldoPendiente,
          estado: i.estado,
        };

        if (i.tipo === TipoInscripcion.SCOUT_ARGENTINA) {
          item.autorizaciones = this.buildAutorizaciones(i, mayorDeEdad);
        }

        return item;
      });
  }

  private buildAutorizaciones(
    i: InscripcionResponseDto,
    mayorDeEdad: boolean,
  ): AutorizacionesInscripcionDto {
    const autorizacionDeImagen = mayorDeEdad ? true : i.autorizacionDeImagen;
    const salidasCercanas = mayorDeEdad ? true : i.salidasCercanas;
    const autorizacionIngreso = mayorDeEdad ? true : i.autorizacionIngreso;

    return {
      declaracionDeSalud: i.declaracionDeSalud,
      autorizacionDeImagen,
      salidasCercanas,
      autorizacionIngreso,
      certificadoAptitudFisica: i.certificadoAptitudFisica,
      completas:
        i.declaracionDeSalud &&
        autorizacionDeImagen &&
        salidasCercanas &&
        autorizacionIngreso &&
        i.certificadoAptitudFisica,
    };
  }

  /**
   * Campamentos del año actual + años pasados con deuda. montoPagado se calcula
   * desde los pagos donde la persona es responsable.
   */
  private buildCampamentoItems(
    participaciones: CampamentoParticipante[],
    movimientosResponsable: Movimiento[],
    currentYear: number,
  ): CampamentoDashboardItemDto[] {
    return participaciones
      .map((cp) => {
        const montoPagado = movimientosResponsable
          .filter(
            (m) =>
              m.campamentoId === cp.campamentoId &&
              m.tipo === TipoMovimiento.INGRESO,
          )
          .reduce((sum, m) => sum + Number(m.monto), 0);
        const montoTotal = Number(cp.campamento.costoPorPersona);

        return {
          id: cp.campamentoId,
          nombre: cp.campamento.nombre,
          ano: new Date(cp.campamento.fechaInicio).getFullYear(),
          montoTotal,
          montoPagado,
          saldoPendiente: montoTotal - montoPagado,
          autorizacionEntregada: cp.autorizacionEntregada,
        };
      })
      .filter((c) => c.ano === currentYear || c.saldoPendiente > 0);
  }

  /**
   * Documentación personal (solo Protagonista). Los Rovers (mayores de edad) no
   * entregan el DNI de los padres: se considera entregado.
   */
  private buildDocumentacionPersonal(
    persona: Persona,
    mayorDeEdad: boolean,
  ): DocumentacionPersonalDto | null {
    if (persona.tipo !== PersonaType.PROTAGONISTA) {
      return null;
    }

    const p = persona as Protagonista;
    const dniPadres = mayorDeEdad ? true : p.dniPadres;

    return {
      partidaNacimiento: p.partidaNacimiento,
      dni: p.dni,
      dniPadres,
      carnetObraSocial: p.carnetObraSocial,
      completa: p.partidaNacimiento && p.dni && dniPadres && p.carnetObraSocial,
    };
  }

  private buildMovimientos(
    movimientos: Movimiento[],
  ): MovimientoDashboardDto[] {
    return movimientos.map((m) => ({
      id: m.id,
      fecha: m.fecha.toISOString(),
      tipo: m.tipo,
      concepto: m.descripcion ?? String(m.concepto),
      monto: Number(m.monto),
      medioPago: m.medioPago,
    }));
  }

  /**
   * Carga las participaciones de campamento de la persona, con el campamento
   * relacionado, para poder calcular su deuda y el estado de autorización.
   */
  private async loadParticipaciones(
    personaId: string,
  ): Promise<CampamentoParticipante[]> {
    return this.participanteRepository
      .createQueryBuilder('cp')
      .innerJoinAndSelect('cp.campamento', 'c')
      .where('cp.personaId = :personaId', { personaId })
      .andWhere('cp.deletedAt IS NULL')
      .andWhere('c.deletedAt IS NULL')
      .getMany();
  }

  /**
   * Merges movement lists from multiple sources, removing duplicates by id
   * (a movement can be both in the caja personal and have the persona as
   * responsable) and ordering by fecha desc, then createdAt desc as tiebreaker.
   */
  private mergeMovimientosByFecha(...listas: Movimiento[][]): Movimiento[] {
    const porId = new Map<string, Movimiento>();
    for (const lista of listas) {
      for (const movimiento of lista) {
        if (CONCEPTOS_OCULTOS_DASHBOARD.has(movimiento.concepto)) {
          continue;
        }
        if (!porId.has(movimiento.id)) {
          porId.set(movimiento.id, movimiento);
        }
      }
    }

    return [...porId.values()].sort((a, b) => {
      const fechaDiff = b.fecha.getTime() - a.fecha.getTime();
      if (fechaDiff !== 0) {
        return fechaDiff;
      }
      return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
    });
  }
}
