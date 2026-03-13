import { ApiProperty } from '@nestjs/swagger';
import { CajaType } from '../../../common/enums';

/**
 * DTO para el detalle de saldo de una caja de rama
 */
export class SaldoRamaDto {
  @ApiProperty({ enum: CajaType, example: CajaType.RAMA_MANADA })
  tipo!: CajaType;

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Fondo Manada' })
  nombre!: string;

  @ApiProperty({ example: 15000.5 })
  saldo!: number;
}

/**
 * DTO para el resumen de fondos de rama
 */
export class FondosRamaDto {
  @ApiProperty({ example: 45000 })
  total!: number;

  @ApiProperty({ type: [SaldoRamaDto] })
  detalle!: SaldoRamaDto[];
}

/**
 * DTO para la caja de grupo
 */
export class CajaGrupoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 150000 })
  saldo!: number;
}

/**
 * DTO para resumen de cuentas personales
 */
export class CuentasPersonalesDto {
  @ApiProperty({ example: 25000 })
  total!: number;

  @ApiProperty({ example: 35, description: 'Cantidad de cuentas personales' })
  cantidad!: number;
}

/**
 * DTO para resumen de reembolsos pendientes
 */
export class ReembolsosPendientesDto {
  @ApiProperty({ example: 8500 })
  total!: number;

  @ApiProperty({
    example: 3,
    description: 'Cantidad de personas con reembolsos pendientes',
  })
  cantidad!: number;
}

/**
 * DTO para deuda por tipo de concepto
 */
export class DeudaTipoDto {
  @ApiProperty({ example: 25000 })
  total!: number;

  @ApiProperty({ example: 12, description: 'Cantidad de registros con deuda' })
  cantidad!: number;
}

/**
 * DTO para el consolidado de todas las deudas
 */
export class DeudasTotalesDto {
  @ApiProperty({ example: 85000 })
  total!: number;

  @ApiProperty({ type: DeudaTipoDto })
  inscripciones!: DeudaTipoDto;

  @ApiProperty({ type: DeudaTipoDto })
  cuotas!: DeudaTipoDto;

  @ApiProperty({ type: DeudaTipoDto })
  campamentos!: DeudaTipoDto;
}

/**
 * DTO para el resumen general
 */
export class ResumenGeneralDto {
  @ApiProperty({
    example: 220000,
    description: 'Suma de grupo + ramas + personales',
  })
  totalGeneral!: number;

  @ApiProperty({
    example: 211500,
    description: 'totalGeneral - reembolsosPendientes',
  })
  totalDisponible!: number;

  @ApiProperty({
    example: 85000,
    description: 'Total de deudas (lo que nos deben)',
  })
  totalPorCobrar!: number;
}

/**
 * DTO principal para el consolidado de saldos
 */
export class ConsolidadoSaldosDto {
  @ApiProperty({ example: '2026-03-12T12:00:00.000Z' })
  fecha!: string;

  @ApiProperty({ type: ResumenGeneralDto })
  resumen!: ResumenGeneralDto;

  @ApiProperty({ type: CajaGrupoDto })
  cajaGrupo!: CajaGrupoDto;

  @ApiProperty({ type: FondosRamaDto })
  fondosRama!: FondosRamaDto;

  @ApiProperty({ type: CuentasPersonalesDto })
  cuentasPersonales!: CuentasPersonalesDto;

  @ApiProperty({ type: ReembolsosPendientesDto })
  reembolsosPendientes!: ReembolsosPendientesDto;

  @ApiProperty({ type: DeudasTotalesDto })
  deudasTotales!: DeudasTotalesDto;
}
