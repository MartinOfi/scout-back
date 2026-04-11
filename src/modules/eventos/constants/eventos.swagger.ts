/**
 * Swagger documentation strings for the Eventos module.
 *
 * Centralizing summaries / descriptions / response messages keeps
 * the @Api* decorators readable and makes copy edits a single-file change.
 */
export const EVENTOS_SWAGGER = {
  TAG: 'Eventos',

  EVENTOS: {
    LIST_SUMMARY: 'Listar todos los eventos',
    LIST_RESPONSE_OK: 'Lista de eventos',

    FIND_ONE_SUMMARY: 'Obtener un evento por ID con resumen financiero',
    FIND_ONE_DESCRIPTION:
      'Retorna el evento con sus productos y el resumen financiero en tiempo real (ingresos, gastos, balance)',
    FIND_ONE_RESPONSE_OK: 'Evento encontrado',
    FIND_ONE_RESPONSE_NOT_FOUND: 'Evento no encontrado',

    CREATE_SUMMARY: 'Crear un evento',
    CREATE_RESPONSE_CREATED: 'Evento creado',

    UPDATE_SUMMARY: 'Actualizar un evento',
    UPDATE_RESPONSE_OK: 'Evento actualizado',
    UPDATE_RESPONSE_NOT_FOUND: 'Evento no encontrado',

    REMOVE_SUMMARY: 'Eliminar un evento (soft delete)',
    REMOVE_RESPONSE_OK: 'Evento eliminado',
    REMOVE_RESPONSE_NOT_FOUND: 'Evento no encontrado',
    REMOVE_RESPONSE_CONFLICT:
      'No se puede eliminar: tiene movimientos manuales (no asociados a ventas) o el evento está cerrado',
  },

  PRODUCTOS: {
    LIST_SUMMARY: 'Listar productos de un evento',
    LIST_RESPONSE_OK: 'Lista de productos con cantidad vendida acumulada',

    CREATE_SUMMARY: 'Crear producto para un evento',
    CREATE_RESPONSE_CREATED: 'Producto creado',

    REMOVE_SUMMARY: 'Eliminar un producto',
    REMOVE_RESPONSE_OK: 'Producto eliminado',
  },

  VENTAS: {
    LIST_SUMMARY: 'Listar ventas de un evento',
    LIST_RESPONSE_OK: 'Lista de ventas',
    QUERY_VENDEDOR_DESCRIPTION:
      'Filtrar ventas por nombre del vendedor (búsqueda parcial, case-insensitive)',

    REGISTRAR_SUMMARY: 'Registrar una venta',
    REGISTRAR_RESPONSE_CREATED: 'Venta registrada',

    REGISTRAR_LOTE_SUMMARY:
      'Registrar ventas de múltiples productos para un vendedor',
    REGISTRAR_LOTE_DESCRIPTION:
      'Permite registrar en una sola request la venta de varios productos por parte de un mismo vendedor',
    REGISTRAR_LOTE_RESPONSE_CREATED: 'Ventas registradas',

    DELETE_SUMMARY: 'Eliminar una venta individual',
    DELETE_DESCRIPTION:
      'Borra la venta y, si corresponde, el movimiento agregado asociado. Atómico: si algo falla, nada se aplica. Si la venta forma parte de un lote, las ventas hermanas también se borran en cascada.',
    DELETE_RESPONSE_OK: 'Venta eliminada',
    DELETE_RESPONSE_NOT_FOUND: 'Venta no encontrada',
    DELETE_RESPONSE_BAD_REQUEST: 'El evento está cerrado y no admite cambios',
    DELETE_RESPONSE_CONFLICT: 'La venta ya fue eliminada',
  },

  KPIS: {
    GET_SUMMARY: 'Obtener KPIs financieros del evento',
    GET_DESCRIPTION:
      'Retorna totales discriminados: ingresos, gastos efectivos (PAGADO) y gastos pendientes de reembolso (PENDIENTE_REEMBOLSO)',
    GET_RESPONSE_OK: 'KPIs del evento',
    GET_RESPONSE_NOT_FOUND: 'Evento no encontrado',
  },

  RESUMEN_VENTAS: {
    GET_SUMMARY: 'Obtener resumen de ventas del evento',
    GET_RESPONSE_OK: 'Resumen de ventas',
    QUERY_VENDEDOR_DESCRIPTION:
      'Filtrar vendedores por nombre (búsqueda parcial)',
  },

  MOVIMIENTOS: {
    LIST_SUMMARY: 'Listar movimientos financieros de un evento',
    LIST_RESPONSE_OK: 'Lista de movimientos del evento',
    LIST_RESPONSE_NOT_FOUND: 'Evento no encontrado',
    QUERY_TIPO_DESCRIPTION: 'Filtrar por tipo: ingreso | egreso',
    QUERY_CONCEPTO_DESCRIPTION: 'Filtrar por concepto de movimiento',
  },

  INGRESOS: {
    REGISTRAR_SUMMARY: 'Registrar ingreso de evento de grupo',
    REGISTRAR_RESPONSE_OK: 'Ingreso registrado',
  },

  GASTOS: {
    REGISTRAR_SUMMARY: 'Registrar gasto del evento',
    REGISTRAR_RESPONSE_OK: 'Gasto registrado',
  },
} as const;
