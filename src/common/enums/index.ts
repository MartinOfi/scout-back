/**
 * Enum definitions for the application
 * All enums centralized - SIN magic strings
 * Based on TRD v2.0 + PRD v1.3
 * Values in lowercase as per TRD specification
 */

// ============================================================================
// PERSONAS
// ============================================================================

/**
 * Types of people in the system (Single Table Inheritance discriminator)
 * From PRD §2.1: Protagonista, Educador, Persona Externa
 *
 * AGRUPACION is not a person: it represents the group itself (or any future
 * collective, e.g. a rama) acting as a seller. It exists so that a sale made
 * "by the group" at a park stand has a real vendedor instead of a stand-in
 * member, which used to distort the participation blocks of the event report.
 *
 * An AGRUPACION never has a caja personal, never appears in member listings and
 * is never part of the deudores report. See CajasService.getOrCreateCajaPersonal.
 */
export enum PersonaType {
  PROTAGONISTA = 'protagonista',
  EDUCADOR = 'educador',
  EXTERNA = 'externo',
  AGRUPACION = 'agrupacion',
}

/**
 * States of a persona
 * From PRD §3.1 (F1, F2): active/inactive state
 */
export enum EstadoPersona {
  ACTIVO = 'activo',
  INACTIVO = 'inactivo',
}

/**
 * Scout branches (Ramas)
 * From PRD §2.2: Manada, Unidad, Caminantes, Rovers
 */
export enum Rama {
  MANADA = 'Manada',
  UNIDAD = 'Unidad',
  CAMINANTES = 'Caminantes',
  ROVERS = 'Rovers',
}

/**
 * Cargos de educadores
 * Rol que desempeña el educador en el grupo scout
 */
export enum CargoEducador {
  EDUCADOR = 'Educador',
  JEFE_DE_RAMA = 'Jefe de Rama',
  JEFE_DE_GRUPO = 'Jefe de Grupo',
}

// ============================================================================
// CAJAS Y MOVIMIENTOS
// ============================================================================

/**
 * Types of "cajas" (financial accounts)
 * From PRD §2.3: Caja de Grupo, Fondos de Rama (x4), Cuentas Personales
 */
export enum CajaType {
  GRUPO = 'grupo',
  RAMA_MANADA = 'rama_manada',
  RAMA_UNIDAD = 'rama_unidad',
  RAMA_CAMINANTES = 'rama_caminantes',
  RAMA_ROVERS = 'rama_rovers',
  PERSONAL = 'personal',
  /**
   * Caja que financia las bonificaciones. Su plata NO es parte de la caja
   * grupo: sólo entra a la caja grupo en el momento de otorgar una bonificación.
   */
  FONDO_SOLIDARIO = 'fondo_solidario',
}

/**
 * Types of movements (income/expense)
 * From PRD §3.6 (F14): Tipo (ingreso/egreso)
 */
export enum TipoMovimiento {
  INGRESO = 'ingreso',
  EGRESO = 'egreso',
}

/**
 * Concepts of movements
 * From TRD §4.1 + PRD analysis
 * 15 concepts total covering all financial flows
 */
export enum ConceptoMovimiento {
  // Inscripciones
  INSCRIPCION_GRUPO = 'inscripcion_grupo', // Ingreso: cobro inscripción grupo
  INSCRIPCION_SCOUT_ARGENTINA = 'inscripcion_scout_argentina', // Ingreso: cobro inscripción SA
  INSCRIPCION_PAGO_SCOUT_ARGENTINA = 'inscripcion_pago_scout_argentina', // Egreso: pago a Scout Argentina

  // Cuotas
  CUOTA_GRUPO = 'cuota_grupo', // Ingreso: cobro cuota de grupo

  // Campamentos
  CAMPAMENTO_PAGO = 'campamento_pago', // Ingreso: pago de participante
  CAMPAMENTO_GASTO = 'campamento_gasto', // Egreso: gasto del campamento

  // Eventos de venta
  EVENTO_VENTA_INGRESO = 'evento_venta_ingreso', // Ingreso: ganancia (margen) de la venta
  EVENTO_VENTA_GASTO = 'evento_venta_gasto', // Egreso: gastos del evento
  EVENTO_VENTA_RECUPERO_COSTO = 'evento_venta_recupero_costo', // Ingreso a caja grupo: recupero del costo de lo vendido (solo destino cuentas_personales)

  // Eventos de grupo
  EVENTO_GRUPO_INGRESO = 'evento_grupo_ingreso', // Ingreso: recaudación evento
  EVENTO_GRUPO_GASTO = 'evento_grupo_gasto', // Egreso: gastos del evento

  // Gastos generales
  GASTO_GENERAL = 'gasto_general', // Egreso: gastos no asociados a eventos

  // Reembolsos
  REEMBOLSO = 'reembolso', // Egreso: devolución a quien adelantó

  // Ajustes
  AJUSTE_INICIAL = 'ajuste_inicial', // Carga de saldo inicial (migración)

  // Fondos de rama
  ASIGNACION_FONDO_RAMA = 'asignacion_fondo_rama', // Ingreso a fondo de rama (no egreso de caja)

  // Transferencias internas
  TRANSFERENCIA_SALDO_PERSONAL = 'transferencia_saldo_personal', // Transferencia total del saldo de una caja personal a la caja grupo
  TRANSFERENCIA_ENTRE_CAJAS = 'transferencia_entre_cajas', // Movimiento de fondos de una caja a otra (egreso+ingreso linkeados)

  // Uso de saldo personal
  USO_SALDO_PERSONAL = 'uso_saldo_personal', // Egreso desde caja personal para pago

  // Bonificaciones (fondo solidario)
  /** Egreso del fondo solidario: ayuda otorgada a una persona */
  BONIFICACION_OTORGADA = 'bonificacion_otorgada',
  /**
   * Ingreso a la caja grupo: contraparte de la bonificación otorgada.
   * Conserva inscripcionId/campamentoId para trazabilidad, pero DEBE
   * excluirse explícitamente de todo cálculo de "cuánto pagó esta persona"
   * — si no, cuenta doble contra montoBonificado.
   */
  BONIFICACION_RECIBIDA = 'bonificacion_recibida',
}

/**
 * Payment methods (Medio de Pago)
 * From PRD §3.3 (F8): "efectivo, transferencia"
 * IMPORTANT: Only 2 methods - NO credit cards, NO debit cards
 * MIXTO: Used when a payment combines physical money (efectivo/transferencia) with personal account balance
 */
export enum MedioPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
  SALDO_PERSONAL = 'saldo_personal',
  MIXTO = 'mixto',
}

/**
 * Payment status for movements
 * From TRD §4.1: Estado de pago
 *
 * The two PENDIENTE values are mirror images of each other and both mean
 * "this movement is recorded but the money has not changed hands yet", so
 * neither affects the caja balance (see MovimientosService.calcularSaldo):
 *
 * - PENDIENTE_REEMBOLSO (egresos): a liability. Someone paid a group expense
 *   out of pocket; the group owes them. The money is still in the caja.
 * - PENDIENTE_COBRO (ingresos): a receivable. A sale was recorded but not
 *   collected yet (e.g. a WhatsApp order). The money is not in the caja.
 */
export enum EstadoPago {
  PAGADO = 'pagado',
  PENDIENTE_REEMBOLSO = 'pendiente_reembolso',
  PENDIENTE_COBRO = 'pendiente_cobro',
}

/**
 * Category of movement — orthogonal axis to concepto, used for reports.
 * Nullable in DB: legacy rows and non-applicable concepts do not require it.
 */
export enum CategoriaMovimiento {
  INSUMOS = 'insumos',
  COMIDA = 'comida',
  TRANSPORTE = 'transporte',
  ALQUILER = 'alquiler',
  SERVICIOS = 'servicios',
  MATERIAL_DIDACTICO = 'material_didactico',
  MANTENIMIENTO = 'mantenimiento',
  OTROS = 'otros',
}

// ============================================================================
// INSCRIPCIONES Y CUOTAS
// ============================================================================

/**
 * Inscription states
 * From TRD §4.1: Estados de inscripción
 */
export enum EstadoInscripcion {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
  BONIFICADO = 'bonificado',
}

/**
 * Tipos de inscripción
 * From Design Doc: GRUPO (grupo local) y SCOUT_ARGENTINA (nacional)
 */
export enum TipoInscripcion {
  GRUPO = 'grupo',
  SCOUT_ARGENTINA = 'scout_argentina',
}

/**
 * Cuota states (similar to inscription but without bonificado)
 * From PRD §3.3 (F9): Cuota de grupo
 */
export enum EstadoCuota {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
}

// ============================================================================
// CAMPAMENTOS
// ============================================================================

/**
 * Estado de pago de participante en campamento
 */
export enum EstadoPagoCampamento {
  PENDIENTE = 'pendiente',
  PARCIAL = 'parcial',
  PAGADO = 'pagado',
  /** Monto asignado 0: no se espera pago (típicamente educadores) */
  EXENTO = 'exento',
}

// ============================================================================
// EVENTOS
// ============================================================================

/**
 * Types of events
 * From PRD §3.4 (F10, F11): Eventos de venta y eventos de grupo
 */
export enum TipoEvento {
  VENTA = 'venta',
  GRUPO = 'grupo',
}

/**
 * Destination of event profits (for sale events)
 * From PRD §3.4 (F10): Destino de ganancia
 *
 * Lives on BOTH Evento and VentaProducto. On the evento it is the default
 * applied to new ventas; on the venta it is the value that actually decides
 * which caja receives the margen. They only differ in MIXTA events.
 */
export enum DestinoGanancia {
  CUENTAS_PERSONALES = 'cuentas_personales',
  CAJA_GRUPO = 'caja_grupo',
}

/**
 * Whether a sale event uses a single destino for every venta or lets each
 * venta pick its own.
 *
 * UNICA: every venta inherits evento.destinoGanancia. Sending a destino per
 *        venta is rejected.
 * MIXTA: each venta must declare its destino. Gastos stay event-wide and are
 *        charged entirely to the group (netoPersonal is not reduced by them).
 */
export enum ModalidadVenta {
  UNICA = 'unica',
  MIXTA = 'mixta',
}

/**
 * Whether the money for a venta has actually been collected.
 *
 * PENDIENTE covers orders taken without payment (typically via WhatsApp), so
 * they are not forgotten. It is the source of truth from which the linked
 * movimiento's EstadoPago is derived: PENDIENTE → PENDIENTE_COBRO, meaning the
 * caja balance stays untouched until the venta is marked as collected.
 */
export enum EstadoCobroVenta {
  COBRADO = 'cobrado',
  PENDIENTE = 'pendiente',
}

// ============================================================================
// FILTROS
// ============================================================================

/**
 * Types of debt for filtering debtors in inscripciones
 * Used to filter by what they owe: documentation, money, or both
 * If not specified, returns any debtor (documentation OR money)
 */
export enum TipoDeuda {
  DOCUMENTACION = 'documentacion', // Only missing documents (SCOUT_ARGENTINA only)
  DINERO = 'dinero', // Only money owed (saldoPendiente > 0)
  AMBOS = 'ambos', // Both money AND documentation debt
}

/**
 * Filter for campamento movements in detail view
 * Used to filter which movements are returned in the response
 */
export enum FiltroMovimientosCampamento {
  TODOS = 'todos', // All movements (INGRESO + EGRESO including USO_SALDO_PERSONAL)
  INGRESOS = 'ingresos', // Only INGRESO movements (payments received)
  EGRESOS = 'egresos', // All EGRESO movements (including USO_SALDO_PERSONAL)
  GASTOS = 'gastos', // Only real expenses (CAMPAMENTO_GASTO, excludes USO_SALDO_PERSONAL)
}

// ============================================================================
// CONCEPTO GROUPS
// ============================================================================

/**
 * Conceptos de movimiento que el sistema genera AUTOMÁTICAMENTE como
 * consecuencia de registrar/borrar una venta de evento.
 *
 * Usar desde:
 *  - DeletionValidator para distinguir movimientos cascadeables de externos.
 *  - VentasEventoService para identificar movimientos a borrar en cascada.
 *  - Migraciones de backfill para parear ventas con su movimiento.
 *
 * Si en el futuro un nuevo concepto nace de una venta, agregarlo acá una vez.
 */
export const VENTA_DERIVED_CONCEPTOS: readonly ConceptoMovimiento[] = [
  ConceptoMovimiento.EVENTO_VENTA_INGRESO,
  ConceptoMovimiento.EVENTO_VENTA_GASTO,
  ConceptoMovimiento.EVENTO_VENTA_RECUPERO_COSTO,
] as const;
