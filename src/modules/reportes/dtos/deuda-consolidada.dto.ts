import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CampamentoDeudaDto {
  @ApiProperty()
  campamentoId!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  ano!: number;

  @ApiProperty()
  montoTotal!: number;

  @ApiProperty()
  montoPagado!: number;

  @ApiProperty()
  saldo!: number;

  @ApiProperty()
  autorizacionEntregada!: boolean;
}

export class InscripcionDeudaDto {
  @ApiProperty()
  inscripcionId!: string;

  @ApiProperty()
  tipo!: string;

  @ApiProperty()
  ano!: number;

  @ApiProperty()
  montoTotal!: number;

  @ApiProperty()
  montoBonificado!: number;

  @ApiProperty()
  montoPagado!: number;

  @ApiProperty()
  saldo!: number;
}

export class CuotaDeudaDto {
  @ApiProperty()
  cuotaId!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  ano!: number;

  @ApiProperty()
  montoTotal!: number;

  @ApiProperty()
  montoPagado!: number;

  @ApiProperty()
  saldo!: number;
}

export class DocumentacionPersonalDto {
  @ApiProperty()
  dni!: boolean;

  @ApiProperty()
  partidaNacimiento!: boolean;

  @ApiProperty()
  dniPadres!: boolean;

  @ApiProperty()
  carnetObraSocial!: boolean;
}

export class DocInscripcionDto {
  @ApiProperty()
  inscripcionId!: string;

  @ApiProperty()
  ano!: number;

  @ApiProperty()
  declaracionDeSalud!: boolean;

  @ApiProperty()
  autorizacionDeImagen!: boolean;

  @ApiProperty()
  salidasCercanas!: boolean;

  @ApiProperty()
  autorizacionIngreso!: boolean;

  @ApiProperty()
  certificadoAptitudFisica!: boolean;
}

export class PersonaDeudaDto {
  @ApiProperty()
  personaId!: string;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  rama!: string;

  @ApiProperty({
    description:
      'Mayor de edad (Educador o Rovers): no entrega DNI de los padres',
  })
  esMayorDeEdad!: boolean;

  @ApiProperty()
  deudaTotal!: number;

  @ApiProperty({ type: [CampamentoDeudaDto] })
  campamentos!: CampamentoDeudaDto[];

  @ApiProperty({ type: [InscripcionDeudaDto] })
  inscripcionesGrupo!: InscripcionDeudaDto[];

  @ApiProperty({ type: [InscripcionDeudaDto] })
  inscripcionesScout!: InscripcionDeudaDto[];

  @ApiProperty({ type: [CuotaDeudaDto] })
  cuotas!: CuotaDeudaDto[];

  @ApiProperty({
    type: DocumentacionPersonalDto,
    nullable: true,
    description: 'null para educadores (no tienen documentación personal)',
  })
  documentacionPersonal!: DocumentacionPersonalDto | null;

  @ApiPropertyOptional({ type: [DocInscripcionDto] })
  documentacionInscripcion!: DocInscripcionDto[];
}
