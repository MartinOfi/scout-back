/**
 * Constants for the event-report feature.
 *
 * A report "variant" is the discriminator that decides which contract and which
 * strategy apply. It is derived from (tipo, destinoGanancia):
 *   - venta + caja_grupo          -> VENTA_CAJA_GRUPO
 *   - venta + cuentas_personales  -> VENTA_CUENTAS_PERSONALES
 *   - grupo                       -> GRUPO
 */
export const REPORTE_VARIANTE = {
  VENTA_CAJA_GRUPO: 'venta_caja_grupo',
  VENTA_CUENTAS_PERSONALES: 'venta_cuentas_personales',
  GRUPO: 'grupo',
} as const;

export type ReporteVariante =
  (typeof REPORTE_VARIANTE)[keyof typeof REPORTE_VARIANTE];

export const REPORTE_SEVERIDAD = {
  ALTA: 'alta',
  MEDIA: 'media',
  OK: 'ok',
} as const;

export type ReporteSeveridad =
  (typeof REPORTE_SEVERIDAD)[keyof typeof REPORTE_SEVERIDAD];

export const REPORTE_ROUTE_SEGMENT = 'reporte';

export const REPORTE_ERROR_MESSAGES = {
  VARIANTE_NO_RESOLVIBLE: (eventoId: string) =>
    `No se pudo resolver la variante de reporte para el evento ${eventoId}. ` +
    `Un evento de venta debe tener destinoGanancia definido.`,
  VARIANTE_SIN_STRATEGY: (variante: string) =>
    `No hay una estrategia de reporte registrada para la variante "${variante}".`,
} as const;

export const REPORTE_SWAGGER = {
  GET_SUMMARY: 'Reporte completo de un evento',
  GET_DESCRIPTION:
    'Devuelve un reporte con contrato variable según la variante del evento ' +
    '(venta+caja_grupo, venta+cuentas_personales, grupo). El campo "variante" ' +
    'discrimina la forma de la respuesta.',
  GET_RESPONSE_OK: 'Reporte del evento',
  GET_RESPONSE_NOT_FOUND: 'Evento no encontrado',
  GET_RESPONSE_BAD_REQUEST:
    'No se pudo resolver la variante (evento de venta sin destinoGanancia)',
} as const;
