import { TipoDeudaFilter } from '../constants/deuda.constants';
import { PersonaDeudaDto } from '../dtos/deuda-consolidada.dto';

/** Origen de deuda por el que se acota el reporte (todos opcionales). */
export interface OrigenDeuda {
  tipo?: TipoDeudaFilter;
  campamentoId?: string;
}

/** Minúsculas y sin tildes: "Martín" y "martin" son lo mismo al buscar. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Sin texto de búsqueda, coincide todo. */
export function coincideConBusqueda(nombre: string, q?: string): boolean {
  const buscado = normalizarTexto(q ?? '');
  if (!buscado) return true;
  return normalizarTexto(nombre).includes(buscado);
}

const sumarSaldos = (items: { saldo: number }[]): number =>
  items.reduce((suma, item) => suma + item.saldo, 0);

/**
 * Deja en la fila solo la deuda de plata del origen pedido (un campamento, o
 * todos los campamentos / inscripciones Scout / inscripciones de grupo) y
 * recalcula el total. Devuelve `null` si la persona no debe nada de ese
 * origen. Sin origen acotante (incluye `dinero` y `documentacion`) la deuda
 * se devuelve tal cual. No muta la entrada.
 */
export function acotarAOrigen(
  deuda: PersonaDeudaDto,
  { tipo, campamentoId }: OrigenDeuda,
): PersonaDeudaDto | null {
  const porCampamento = campamentoId !== undefined;
  const acota =
    porCampamento ||
    tipo === TipoDeudaFilter.CAMPAMENTOS ||
    tipo === TipoDeudaFilter.INSCRIPCIONES_SCOUT ||
    tipo === TipoDeudaFilter.INSCRIPCIONES_GRUPO;
  if (!acota) return deuda;

  const campamentos =
    porCampamento || tipo === TipoDeudaFilter.CAMPAMENTOS
      ? deuda.campamentos.filter(
          (c) =>
            c.saldo > 0 && (!porCampamento || c.campamentoId === campamentoId),
        )
      : [];
  const inscripcionesScout =
    !porCampamento && tipo === TipoDeudaFilter.INSCRIPCIONES_SCOUT
      ? deuda.inscripcionesScout
      : [];
  const inscripcionesGrupo =
    !porCampamento && tipo === TipoDeudaFilter.INSCRIPCIONES_GRUPO
      ? deuda.inscripcionesGrupo
      : [];

  const deudaTotal =
    sumarSaldos(campamentos) +
    sumarSaldos(inscripcionesScout) +
    sumarSaldos(inscripcionesGrupo);
  if (deudaTotal <= 0) return null;

  return {
    ...deuda,
    campamentos,
    inscripcionesScout,
    inscripcionesGrupo,
    deudaTotal,
  };
}
