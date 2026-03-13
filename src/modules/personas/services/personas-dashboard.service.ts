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
import {
  PersonaDashboardDto,
  InscripcionDashboardItemDto,
  CuotaDashboardItemDto,
  MovimientoDashboardDto,
  AutorizacionesInscripcionDto,
} from '../dtos/persona-dashboard.dto';
import { PersonaType, TipoInscripcion } from '../../../common/enums';

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
    const [saldo, inscripciones, cuotas, movimientos] = await Promise.all([
      this.movimientosService.calcularSaldo(cajaPersonal.id),
      this.inscripcionesService.findByPersona(personaId),
      this.cuotasService.findByPersona(personaId),
      this.movimientosService.findByCaja(cajaPersonal.id),
    ]);

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
    const deudaCuotas = cuotaItems.reduce((sum, c) => sum + c.saldoPendiente, 0);

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
        tipo:
          persona.tipo === PersonaType.PROTAGONISTA ? 'Protagonista' : 'Educador',
        estado: persona.estado,
        rama: persona.rama ?? null,
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
}
