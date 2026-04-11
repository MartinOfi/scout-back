/**
 * Error message factories for the Eventos module.
 *
 * Functions are preferred over plain strings when the message embeds
 * a runtime value (id, count, etc.). This keeps interpolation logic
 * out of services and tests.
 *
 * Add new entries here BEFORE throwing a new exception in service code.
 */
export const EVENTOS_ERROR_MESSAGES = {
  EVENTO_NOT_FOUND: (id: string): string => `Evento con ID ${id} no encontrado`,
  EVENTO_CERRADO:
    'El evento está cerrado y no admite modificaciones (incluyendo borrados)',
  EVENTO_HAS_EXTERNAL_MOVEMENTS: (count: number): string =>
    `No se puede eliminar: el evento tiene ${count} movimiento(s) externo(s) a ventas (ingresos/gastos manuales)`,
  ONLY_FOR_EVENTO_GRUPO: 'Este endpoint es solo para eventos de grupo',
} as const;

export const PRODUCTOS_ERROR_MESSAGES = {
  PRODUCTO_NOT_FOUND: (id: string): string =>
    `Producto con ID ${id} no encontrado`,
  PRODUCTO_NOT_IN_EVENTO: 'El producto no pertenece a este evento',
  PRODUCTO_NOT_FOUND_IN_EVENTO: (id: string): string =>
    `Producto con ID ${id} no encontrado en este evento`,
  CANNOT_DELETE_WITH_MOVEMENTS:
    'No se puede eliminar: el evento tiene movimientos asociados',
} as const;

export const VENTAS_ERROR_MESSAGES = {
  VENTA_NOT_FOUND: (id: string): string => `Venta con ID ${id} no encontrada`,
  VENTA_NOT_IN_EVENTO: 'La venta no pertenece a este evento',
  VENTA_ALREADY_DELETED: 'La venta ya fue eliminada',
} as const;
