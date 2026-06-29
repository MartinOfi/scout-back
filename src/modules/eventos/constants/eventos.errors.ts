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
  EVENTO_YA_CERRADO: 'El evento ya está cerrado',
  EVENTO_HAS_EXTERNAL_MOVEMENTS: (count: number): string =>
    `No se puede eliminar: el evento tiene ${count} movimiento(s) externo(s) a ventas (ingresos/gastos manuales)`,
  ONLY_FOR_EVENTO_GRUPO: 'Este endpoint es solo para eventos de grupo',
  VENTA_REQUIRES_DESTINO_GANANCIA:
    'Los eventos de venta requieren especificar un destino de ganancia',
  GRUPO_CANNOT_HAVE_DESTINO_GANANCIA:
    'Los eventos de grupo no pueden tener destino de ganancia',
  MOVIMIENTOS_SOLO_PARA_VENTA:
    'Solo los eventos de venta pueden habilitar movimientos',
  MOVIMIENTOS_YA_HABILITADOS:
    'Los movimientos de este evento ya están habilitados',
  SIN_PRODUCTOS_PARA_HABILITAR:
    'No se pueden habilitar los movimientos: el evento no tiene productos cargados',
  PRODUCTOS_SIN_COSTO: (nombres: string): string =>
    `No se pueden habilitar los movimientos: los siguientes productos no tienen precio de costo cargado: ${nombres}`,
} as const;

export const PRODUCTOS_ERROR_MESSAGES = {
  PRODUCTO_NOT_FOUND: (id: string): string =>
    `Producto con ID ${id} no encontrado`,
  PRODUCTO_NOT_IN_EVENTO: 'El producto no pertenece a este evento',
  PRODUCTO_NOT_FOUND_IN_EVENTO: (id: string): string =>
    `Producto con ID ${id} no encontrado en este evento`,
  CANNOT_DELETE_WITH_MOVEMENTS:
    'No se puede eliminar: el evento tiene movimientos asociados',
  CANNOT_EDIT_PRICES_WITH_MOVIMIENTOS:
    'No se pueden modificar los precios: el evento ya tiene los movimientos habilitados. Los precios quedan congelados una vez habilitados.',
} as const;

export const VENTAS_ERROR_MESSAGES = {
  VENTA_NOT_FOUND: (id: string): string => `Venta con ID ${id} no encontrada`,
  VENTA_NOT_IN_EVENTO: 'La venta no pertenece a este evento',
  VENTA_ALREADY_DELETED: 'La venta ya fue eliminada',
  VENTA_HAS_ENTREGAS:
    'No se puede eliminar la venta: existen entregas asociadas. Eliminá primero las entregas.',
} as const;

export const ENTREGAS_ERROR_MESSAGES = {
  ENTREGA_NOT_FOUND: (id: string): string =>
    `Entrega con ID ${id} no encontrada`,
  ENTREGA_NOT_IN_EVENTO: 'La entrega no pertenece a este evento',
  ENTREGA_ALREADY_DELETED: 'La entrega ya fue eliminada',
  STOCK_INSUFICIENTE: (
    productoNombre: string,
    disponible: number,
    solicitado: number,
  ): string =>
    `Stock insuficiente del producto "${productoNombre}" para este vendedor: disponible ${disponible}, solicitado ${solicitado}`,
  VENDEDOR_SIN_VENTAS_DEL_PRODUCTO: (productoNombre: string): string =>
    `El vendedor no tiene ventas del producto "${productoNombre}" en este evento`,
  DUPLICATE_PRODUCTO_IN_ITEMS:
    'Hay productos duplicados en los items de la entrega',
} as const;
