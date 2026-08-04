/**
 * Constantes del flujo de ventas de eventos.
 */

/**
 * Nota con la que se marca la Entrega creada en el mismo acto que la venta
 * ("entregado en el acto", a diferencia de una preventa).
 *
 * Es lo que distingue una entrega inmediata de una cargada por separado, y de
 * eso dependen dos comportamientos: borrar la venta arrastra su entrega
 * inmediata, pero sigue bloqueando si hay entregas cargadas aparte.
 */
export const ENTREGA_INMEDIATA_NOTA = 'Entregado en el acto';
