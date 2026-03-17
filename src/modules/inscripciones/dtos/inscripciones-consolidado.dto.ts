import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TipoInscripcion,
  TipoDeuda,
  Rama,
  PersonaType,
} from '../../../common/enums';

/**
 * Distribution breakdown by rama for count-based metrics
 */
export class DistribucionPorRamaDto {
  @ApiProperty({ description: 'Total across all categories' })
  total!: number;

  @ApiProperty({ description: 'Manada branch count' })
  manada!: number;

  @ApiProperty({ description: 'Unidad branch count' })
  unidad!: number;

  @ApiProperty({ description: 'Caminantes branch count' })
  caminantes!: number;

  @ApiProperty({ description: 'Rovers branch count' })
  rovers!: number;

  @ApiProperty({ description: 'Educadores (adults) count' })
  educadores!: number;
}

/**
 * Financial summary for inscriptions
 */
export class ResumenFinancieroDto {
  @ApiProperty({ description: 'Total expected amount (sum of montoTotal)' })
  montoEsperado!: number;

  @ApiProperty({ description: 'Total already paid' })
  montoPagado!: number;

  @ApiProperty({
    description: 'Total owed (montoEsperado - montoBonificado - montoPagado)',
  })
  montoAdeudado!: number;

  @ApiProperty({ description: 'Total bonificado/discounted' })
  montoBonificado!: number;
}

/**
 * Money debt summary
 */
export class DeudaDineroDto {
  @ApiProperty({
    description: 'Number of inscriptions with pending balance > 0',
  })
  total!: number;

  @ApiProperty({ description: 'Total amount owed' })
  monto!: number;

  @ApiProperty({ description: 'Distribution by rama' })
  porRama!: DistribucionPorRamaDto;
}

/**
 * Documentation debt summary (only for SCOUT_ARGENTINA inscriptions)
 */
export class DeudaDocumentacionDto {
  @ApiProperty({
    description: 'Number of inscriptions with at least one missing document',
  })
  total!: number;

  @ApiProperty({ description: 'Distribution by rama' })
  porRama!: DistribucionPorRamaDto;
}

/**
 * Combined debtors summary
 */
export class DeudoresResumenDto {
  @ApiProperty({ description: 'Debtors with money debt' })
  dinero!: DeudaDineroDto;

  @ApiProperty({
    description: 'Debtors with documentation debt (only SCOUT_ARGENTINA)',
  })
  documentacion!: DeudaDocumentacionDto;

  @ApiProperty({
    description: 'Debtors with both money AND documentation debt',
  })
  ambos!: DistribucionPorRamaDto;
}

/**
 * Filters applied to the consolidation query
 */
export class FiltrosConsolidadoDto {
  @ApiPropertyOptional({ description: 'Year filter applied' })
  ano?: number;

  @ApiPropertyOptional({
    enum: TipoInscripcion,
    description: 'Inscription type filter applied',
  })
  tipo?: TipoInscripcion;

  @ApiPropertyOptional({
    enum: TipoDeuda,
    description: 'Debt type filter applied',
  })
  tipoDeuda?: TipoDeuda;

  @ApiPropertyOptional({
    enum: [...Object.values(Rama), PersonaType.EDUCADOR],
    description:
      'Rama filter applied (can be a branch or "educador" for educators)',
  })
  rama?: Rama | typeof PersonaType.EDUCADOR;
}

/**
 * Main consolidated inscriptions response
 */
export class InscripcionesConsolidadoDto {
  @ApiProperty({ description: 'Query parameters applied' })
  filtros!: FiltrosConsolidadoDto;

  @ApiProperty({ description: 'Total inscriptions matching filters' })
  total!: number;

  @ApiProperty({ description: 'Distribution by rama' })
  porRama!: DistribucionPorRamaDto;

  @ApiProperty({ description: 'Financial summary' })
  financiero!: ResumenFinancieroDto;

  @ApiProperty({ description: 'Debtors breakdown' })
  deudores!: DeudoresResumenDto;

  @ApiProperty({ description: 'Timestamp of the consolidation (ISO 8601)' })
  fecha!: string;
}
