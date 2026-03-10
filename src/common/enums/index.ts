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
 */
export enum PersonaType {
  PROTAGONISTA = 'protagonista',
  EDUCADOR = 'educador',
  EXTERNA = 'externo',
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
  EVENTO_VENTA_INGRESO = 'evento_venta_ingreso', // Ingreso: ventas del evento
  EVENTO_VENTA_GASTO = 'evento_venta_gasto', // Egreso: gastos del evento

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
  TRANSFERENCIA_BAJA = 'transferencia_baja', // Transferencia de cuenta personal a caja al dar baja
}

/**
 * Payment methods (Medio de Pago)
 * From PRD §3.3 (F8): "efectivo, transferencia"
 * IMPORTANT: Only 2 methods - NO credit cards, NO debit cards
 */
export enum MedioPago {
  EFECTIVO = 'efectivo',
  TRANSFERENCIA = 'transferencia',
}

/**
 * Payment status for movements (egresos)
 * From TRD §4.1: Estado de pago
 */
export enum EstadoPago {
  PAGADO = 'pagado',
  PENDIENTE_REEMBOLSO = 'pendiente_reembolso',
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
 */
export enum DestinoGanancia {
  CUENTAS_PERSONALES = 'cuentas_personales',
  CAJA_GRUPO = 'caja_grupo',
}
