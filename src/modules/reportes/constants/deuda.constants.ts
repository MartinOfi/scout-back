import { Rama } from '../../../common/enums';

/**
 * Etiqueta con la que se agrupan los educadores en el reporte de deudas y
 * valor aceptado por el filtro de rama para verlos aislados.
 *
 * No es una rama real: un educador puede tener rama asignada o no, y en ambos
 * casos se lista bajo este grupo.
 */
export const RAMA_EDUCADORES = 'Educadores';

/** Valores válidos del filtro `rama` del reporte de deudas. */
export const DEUDA_RAMA_FILTERS = [
  ...Object.values(Rama),
  RAMA_EDUCADORES,
] as const;

export type DeudaRamaFilter = (typeof DEUDA_RAMA_FILTERS)[number];

/**
 * Tipos de deuda por los que se puede filtrar el reporte.
 * `DINERO` unifica toda la deuda monetaria (campamentos, inscripciones Scout
 * AR, inscripciones de grupo y cuotas) en un solo filtro. Ausente el
 * parámetro, se devuelven todos los tipos.
 */
export enum TipoDeudaFilter {
  DINERO = 'dinero',
  CAMPAMENTOS = 'campamentos',
  INSCRIPCIONES_SCOUT = 'inscripcionesScout',
  INSCRIPCIONES_GRUPO = 'inscripcionesGrupo',
  CUOTAS = 'cuotas',
  DOCUMENTACION = 'documentacion',
}
