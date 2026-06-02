/**
 * Route segments and URL parameter names for the Eventos module.
 *
 * Centralizing these prevents:
 *  - Magic strings in @Controller / @Get / @Post / @Param decorators.
 *  - Drift between controller routes and tests / clients.
 *  - Typos that pass type-check (e.g. 'venats' vs 'ventas').
 *
 * Add new segments here before referencing them in decorators.
 */
export const EVENTOS_ROUTE_SEGMENTS = {
  BASE: 'eventos',
  PRODUCTOS: 'productos',
  VENTAS: 'ventas',
  VENTAS_LOTE: 'ventas/lote',
  KPIS: 'kpis',
  RESUMEN_VENTAS: 'resumen-ventas',
  MOVIMIENTOS: 'movimientos',
  INGRESOS: 'ingresos',
  GASTOS: 'gastos',
  ENTREGAS: 'entregas',
  ENTREGAS_STOCK_DISPONIBLE: 'stock-disponible',
  REPORTE: 'reporte',
  CERRAR: 'cerrar',
} as const;

/**
 * Names of URL parameters used by the Eventos controller.
 * MUST match @Param() argument names exactly.
 */
export const EVENTOS_PARAM_NAMES = {
  EVENTO_ID: 'eventoId',
  PRODUCTO_ID: 'productoId',
  VENTA_ID: 'ventaId',
  ENTREGA_ID: 'entregaId',
} as const;

/**
 * Names of query string parameters used by the Eventos controller.
 */
export const EVENTOS_QUERY_NAMES = {
  TIPO: 'tipo',
  CONCEPTO: 'concepto',
  VENDEDOR: 'vendedor',
} as const;

/**
 * Pre-built route patterns combining segments and params.
 * Use these in @Get / @Post / @Delete instead of inlining.
 */
export const EVENTOS_ROUTES = {
  ROOT: '',
  BY_ID: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}`,
  PRODUCTOS_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.PRODUCTOS}`,
  PRODUCTO_BY_ID: `${EVENTOS_ROUTE_SEGMENTS.PRODUCTOS}/:${EVENTOS_PARAM_NAMES.PRODUCTO_ID}`,
  VENTAS_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.VENTAS}`,
  VENTAS_LOTE_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.VENTAS_LOTE}`,
  VENTA_BY_ID: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.VENTAS}/:${EVENTOS_PARAM_NAMES.VENTA_ID}`,
  KPIS_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.KPIS}`,
  RESUMEN_VENTAS_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.RESUMEN_VENTAS}`,
  MOVIMIENTOS_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.MOVIMIENTOS}`,
  INGRESOS_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.INGRESOS}`,
  GASTOS_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.GASTOS}`,
  REPORTE_BY_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.REPORTE}`,
  CERRAR_EVENTO: `:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.CERRAR}`,
} as const;

/**
 * Sub-routes for the EntregasController. The controller's base path is
 * `eventos/:eventoId/entregas`; these are the segments below that base.
 *
 * IMPORTANT: declare STOCK_DISPONIBLE before BY_ID in the controller to
 * avoid `:entregaId` shadowing the literal `stock-disponible` path.
 */
export const ENTREGAS_ROUTES = {
  ROOT: '',
  STOCK_DISPONIBLE: EVENTOS_ROUTE_SEGMENTS.ENTREGAS_STOCK_DISPONIBLE,
  BY_ID: `:${EVENTOS_PARAM_NAMES.ENTREGA_ID}`,
} as const;

/**
 * Base path for the EntregasController.
 */
export const ENTREGAS_CONTROLLER_PATH = `${EVENTOS_ROUTE_SEGMENTS.BASE}/:${EVENTOS_PARAM_NAMES.EVENTO_ID}/${EVENTOS_ROUTE_SEGMENTS.ENTREGAS}`;
