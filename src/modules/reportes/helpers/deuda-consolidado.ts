import { TipoDeudaFilter } from '../constants/deuda.constants';
import { PersonaDeudaDto } from '../dtos/deuda-consolidada.dto';
import {
  CampamentoConsolidadoDto,
  ConsolidadoDeudasDto,
  InscripcionConsolidadaDto,
} from '../dtos/consolidado-deudas.dto';

interface Acumulado {
  deudaTotal: number;
  personas: Set<string>;
}

const sumar = (items: { saldo: number }[]): number =>
  items.reduce((suma, item) => suma + item.saldo, 0);

/** Suma `saldo` en el grupo `clave`, sin mutar el mapa recibido. */
function acumular(
  mapa: ReadonlyMap<string, Acumulado>,
  clave: string,
  saldo: number,
  personaId: string,
): Map<string, Acumulado> {
  const previo = mapa.get(clave);
  return new Map(mapa).set(clave, {
    deudaTotal: (previo?.deudaTotal ?? 0) + saldo,
    personas: new Set(previo?.personas).add(personaId),
  });
}

function agruparCampamentos(
  deudas: PersonaDeudaDto[],
): CampamentoConsolidadoDto[] {
  const datos = new Map<string, { nombre: string; ano: number }>();
  const totales = deudas.reduce(
    (mapa, d) =>
      d.campamentos
        .filter((c) => c.saldo > 0)
        .reduce((m, c) => {
          datos.set(c.campamentoId, { nombre: c.nombre, ano: c.ano });
          return acumular(m, c.campamentoId, c.saldo, d.personaId);
        }, mapa),
    new Map<string, Acumulado>(),
  );

  return [...totales.entries()]
    .map(([campamentoId, t]) => ({
      campamentoId,
      nombre: datos.get(campamentoId)?.nombre ?? '',
      ano: datos.get(campamentoId)?.ano ?? 0,
      deudaTotal: t.deudaTotal,
      personasConDeuda: t.personas.size,
    }))
    .sort((a, b) => b.ano - a.ano || a.nombre.localeCompare(b.nombre));
}

function agruparInscripciones(
  deudas: PersonaDeudaDto[],
): InscripcionConsolidadaDto[] {
  const grupos: {
    tipo: TipoDeudaFilter;
    items: (d: PersonaDeudaDto) => PersonaDeudaDto['inscripcionesScout'];
  }[] = [
    {
      tipo: TipoDeudaFilter.INSCRIPCIONES_SCOUT,
      items: (d) => d.inscripcionesScout,
    },
    {
      tipo: TipoDeudaFilter.INSCRIPCIONES_GRUPO,
      items: (d) => d.inscripcionesGrupo,
    },
  ];
  return grupos
    .flatMap(({ tipo, items }) => {
      const totales = deudas.reduce(
        (mapa, d) =>
          items(d)
            .filter((i) => i.saldo > 0)
            .reduce(
              (m, i) => acumular(m, String(i.ano), i.saldo, d.personaId),
              mapa,
            ),
        new Map<string, Acumulado>(),
      );
      return [...totales.entries()].map(([ano, t]) => ({
        tipo,
        ano: Number(ano),
        deudaTotal: t.deudaTotal,
        personasConDeuda: t.personas.size,
      }));
    })
    .sort((a, b) => b.ano - a.ano || a.tipo.localeCompare(b.tipo));
}

/**
 * Resumen de la deuda de plata por origen. Solo incluye orígenes con saldo
 * pendiente: apenas uno se salda deja de aparecer (y de ofrecerse como filtro).
 */
export function buildConsolidado(
  deudas: PersonaDeudaDto[],
): ConsolidadoDeudasDto {
  const deudaCampamentos = deudas.reduce((s, d) => s + sumar(d.campamentos), 0);
  const deudaInscripcionesScout = deudas.reduce(
    (s, d) => s + sumar(d.inscripcionesScout),
    0,
  );
  const deudaInscripcionesGrupo = deudas.reduce(
    (s, d) => s + sumar(d.inscripcionesGrupo),
    0,
  );
  return {
    personasConDeuda: deudas.filter((d) => d.deudaTotal > 0).length,
    deudaTotal:
      deudaCampamentos + deudaInscripcionesScout + deudaInscripcionesGrupo,
    deudaCampamentos,
    deudaInscripcionesScout,
    deudaInscripcionesGrupo,
    campamentos: agruparCampamentos(deudas),
    inscripciones: agruparInscripciones(deudas),
  };
}
