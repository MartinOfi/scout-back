import { ConceptoMovimiento, MedioPago } from '../../../common/enums';

export class MovimientoIngresoResultDto {
  id!: string;
  monto!: number;
  concepto!: ConceptoMovimiento;
  medioPago!: MedioPago;
}

export class MovimientoEgresoResultDto {
  id!: string;
  monto!: number;
}

export class DesgloseResultDto {
  montoSaldoPersonal!: number;
  montoFisico!: number;
  total!: number;
}

export class ResultadoPagoDto {
  movimientoIngreso!: MovimientoIngresoResultDto;
  movimientoEgresoPersonal?: MovimientoEgresoResultDto;
  desglose!: DesgloseResultDto;
}
