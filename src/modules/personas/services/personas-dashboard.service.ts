// src/modules/personas/services/personas-dashboard.service.ts
import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PersonasService } from '../personas.service';
import { CajasService } from '../../cajas/cajas.service';
import { InscripcionesService } from '../../inscripciones/inscripciones.service';
import { CuotasService } from '../../cuotas/cuotas.service';
import { MovimientosService } from '../../movimientos/movimientos.service';
import { Movimiento } from '../../movimientos/entities/movimiento.entity';
import {
  PersonaDashboardDto,
  InscripcionDashboardItemDto,
  CuotaDashboardItemDto,
  MovimientoDashboardDto,
  AutorizacionesInscripcionDto,
} from '../dtos/persona-dashboard.dto';
import {
  PersonaType,
  TipoInscripcion,
  ConceptoMovimiento,
} from '../../../common/enums';

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
    @Inject(forwardRef(() => CuotasService))
    private readonly cuotasService: CuotasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
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
      cuotas,
      movimientosResponsable,
      movimientosCaja,
    ] = await Promise.all([
      this.movimientosService.calcularSaldo(cajaPersonal.id),
      this.inscripcionesService.findByPersona(personaId),
      this.cuotasService.findByPersona(personaId),
      this.movimientosService.findByResponsable(personaId),
      this.movimientosService.findByCaja(cajaPersonal.id),
    ]);

    const movimientos = this.mergeMovimientosByFecha(
      movimientosResponsable,
      movimientosCaja,
    );

    const currentYear = new Date().getFullYear();

    // 4. Filter inscriptions: current year + past with debt
    const filteredInscripciones = inscripciones.filter(
      (i) => i.ano === currentYear || i.saldoPendiente > 0,
    );

    // 5. Filter cuotas: current year + past with debt
    const filteredCuotas = cuotas.filter((c) => {
      const saldoPendiente = c.montoTotal - c.montoPagado;
      return c.ano === currentYear || saldoPendiente > 0;
    });

    // 6. Map inscriptions to dashboard items
    const inscripcionItems: InscripcionDashboardItemDto[] =
      filteredInscripciones.map((i) => {
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

        // Only include autorizaciones for SCOUT_ARGENTINA
        if (i.tipo === TipoInscripcion.SCOUT_ARGENTINA) {
          const autorizaciones: AutorizacionesInscripcionDto = {
            declaracionDeSalud: i.declaracionDeSalud,
            autorizacionDeImagen: i.autorizacionDeImagen,
            salidasCercanas: i.salidasCercanas,
            autorizacionIngreso: i.autorizacionIngreso,
            certificadoAptitudFisica: i.certificadoAptitudFisica,
            completas:
              i.declaracionDeSalud &&
              i.autorizacionDeImagen &&
              i.salidasCercanas &&
              i.autorizacionIngreso &&
              i.certificadoAptitudFisica,
          };
          item.autorizaciones = autorizaciones;
        }

        return item;
      });

    // 7. Map cuotas to dashboard items
    const cuotaItems: CuotaDashboardItemDto[] = filteredCuotas.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      ano: c.ano,
      montoTotal: Number(c.montoTotal),
      montoPagado: Number(c.montoPagado),
      saldoPendiente: Number(c.montoTotal) - Number(c.montoPagado),
      estado: c.estado,
    }));

    // 8. Calculate debt totals
    const deudaInscripciones = inscripcionItems.reduce(
      (sum, i) => sum + i.saldoPendiente,
      0,
    );
    const deudaCuotas = cuotaItems.reduce(
      (sum, c) => sum + c.saldoPendiente,
      0,
    );

    // 9. Map movements (last 5)
    const ultimosMovimientos: MovimientoDashboardDto[] = movimientos
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        fecha: m.fecha.toISOString(),
        tipo: m.tipo,
        concepto: m.descripcion ?? String(m.concepto),
        monto: Number(m.monto),
        medioPago: m.medioPago,
      }));

    // 10. Build documentacion personal (Protagonista only)
    const documentacionPersonal =
      persona.tipo === PersonaType.PROTAGONISTA
        ? {
            partidaNacimiento: (persona as any).partidaNacimiento ?? false,
            dni: (persona as any).dni ?? false,
            dniPadres: (persona as any).dniPadres ?? false,
            carnetObraSocial: (persona as any).carnetObraSocial ?? false,
            completa:
              ((persona as any).partidaNacimiento ?? false) &&
              ((persona as any).dni ?? false) &&
              ((persona as any).dniPadres ?? false) &&
              ((persona as any).carnetObraSocial ?? false),
          }
        : null;

    // 11. Assemble response
    return {
      persona: {
        id: persona.id,
        nombre: persona.nombre,
        tipo: persona.tipo,
        estado: persona.estado,
        rama: (persona as any).rama ?? null,
        cargo:
          persona.tipo === PersonaType.EDUCADOR
            ? (persona as any).cargo
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
      cuotas: {
        resumen: {
          total: deudaCuotas,
          cantidad: cuotaItems.filter((c) => c.saldoPendiente > 0).length,
        },
        items: cuotaItems,
      },
      deudaTotal: {
        total: deudaInscripciones + deudaCuotas,
        inscripciones: deudaInscripciones,
        cuotas: deudaCuotas,
      },
      ultimosMovimientos,
    };
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
