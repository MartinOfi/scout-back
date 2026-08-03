export interface OtorgarBonificacionParams {
  readonly personaId: string;
  readonly monto: number;
  readonly campamentoId?: string;
  readonly inscripcionId?: string;
  readonly descripcion?: string;
  readonly registradoPorId?: string;
}
