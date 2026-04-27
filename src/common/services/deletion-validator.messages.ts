/**
 * Error message factories for the DeletionValidatorService.
 *
 * Centralised so callers (services and tests) can match against a single
 * source of truth instead of hard-coding strings.
 */
export const DELETION_VALIDATOR_MESSAGES = {
  PERSONA_IS_RESPONSABLE: (count: number): string =>
    `No se puede eliminar: la persona es responsable de ${count} movimiento(s)`,
  PERSONA_HAS_REIMBURSEMENTS: (count: number): string =>
    `No se puede eliminar: la persona tiene ${count} reembolso(s) registrado(s)`,
  INSCRIPCION_HAS_MOVEMENTS: (count: number): string =>
    `No se puede eliminar: la inscripción tiene ${count} movimiento(s) asociado(s)`,
  CUOTA_HAS_MOVEMENTS: (count: number): string =>
    `No se puede eliminar: la cuota tiene ${count} movimiento(s) asociado(s)`,
  CAMPAMENTO_HAS_MOVEMENTS: (count: number): string =>
    `No se puede eliminar: el campamento tiene ${count} movimiento(s) asociado(s)`,
  EVENTO_HAS_EXTERNAL_MOVEMENTS: (count: number): string =>
    `No se puede eliminar: el evento tiene ${count} movimiento(s) externo(s) a ventas (ingresos/gastos manuales)`,
  CAJA_HAS_MOVEMENTS: (count: number): string =>
    `No se puede eliminar: la caja tiene ${count} movimiento(s) asociado(s)`,
  PARTICIPANTE_CAMPAMENTO_HAS_MOVEMENTS: (count: number): string =>
    `No se puede desinscribir: el participante tiene ${count} pago(s) registrado(s) en este campamento`,
} as const;
