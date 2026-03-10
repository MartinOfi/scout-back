import { MedioPago, ConceptoMovimiento } from '../../../common/enums';

export interface EjecutarPagoParams {
  personaId: string;
  montoTotal: number;
  montoConSaldoPersonal: number;
  medioPago?: MedioPago;
  concepto: ConceptoMovimiento;
  inscripcionId?: string;
  cuotaId?: string;
  campamentoId?: string;
  descripcion?: string;
}
