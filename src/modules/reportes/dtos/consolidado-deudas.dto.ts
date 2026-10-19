import { ApiProperty } from '@nestjs/swagger';
import { TipoDeudaFilter } from '../constants/deuda.constants';

export class CampamentoConsolidadoDto {
  @ApiProperty({ description: 'Valor para el filtro `campamentoId`' })
  campamentoId!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  ano!: number;

  @ApiProperty({ description: 'Saldo adeudado en este campamento' })
  deudaTotal!: number;

  @ApiProperty()
  personasConDeuda!: number;
}

export class InscripcionConsolidadaDto {
  @ApiProperty({
    enum: [
      TipoDeudaFilter.INSCRIPCIONES_SCOUT,
      TipoDeudaFilter.INSCRIPCIONES_GRUPO,
    ],
    description: 'Valor para el filtro `tipo` (junto con `ano`)',
  })
  tipo!: TipoDeudaFilter;

  @ApiProperty()
  ano!: number;

  @ApiProperty()
  deudaTotal!: number;

  @ApiProperty()
  personasConDeuda!: number;
}

export class ConsolidadoDeudasDto {
  @ApiProperty({ description: 'Personas con deuda de plata' })
  personasConDeuda!: number;

  @ApiProperty()
  deudaTotal!: number;

  @ApiProperty()
  deudaCampamentos!: number;

  @ApiProperty()
  deudaInscripcionesScout!: number;

  @ApiProperty()
  deudaInscripcionesGrupo!: number;

  @ApiProperty({
    type: [CampamentoConsolidadoDto],
    description: 'Solo campamentos que todavía registran deuda',
  })
  campamentos!: CampamentoConsolidadoDto[];

  @ApiProperty({
    type: [InscripcionConsolidadaDto],
    description: 'Solo inscripciones (tipo + año) que todavía registran deuda',
  })
  inscripciones!: InscripcionConsolidadaDto[];
}
