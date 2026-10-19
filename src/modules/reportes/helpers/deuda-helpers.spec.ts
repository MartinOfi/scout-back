import { EstadoPersona, PersonaType } from '../../../common/enums';
import { TipoDeudaFilter } from '../constants/deuda.constants';
import { PersonaDeudaDto } from '../dtos/deuda-consolidada.dto';
import { buildConsolidado } from './deuda-consolidado';
import { acotarAOrigen, coincideConBusqueda } from './deuda-filters';

const camp = (over: Partial<PersonaDeudaDto['campamentos'][number]> = {}) => ({
  campamentoId: 'camp-inicio',
  nombre: 'Campamento de Inicio',
  ano: 2026,
  montoTotal: 32000,
  montoPagado: 0,
  saldo: 32000,
  autorizacionEntregada: true,
  ...over,
});

const insc = (
  over: Partial<PersonaDeudaDto['inscripcionesGrupo'][number]> = {},
) => ({
  inscripcionId: 'insc-1',
  tipo: 'grupo',
  ano: 2026,
  montoTotal: 10000,
  montoBonificado: 0,
  montoPagado: 0,
  saldo: 10000,
  ...over,
});

const persona = (over: Partial<PersonaDeudaDto> = {}): PersonaDeudaDto => ({
  personaId: 'p1',
  nombre: 'Martín Oficialdegui',
  tipo: PersonaType.PROTAGONISTA,
  estado: EstadoPersona.ACTIVO,
  rama: 'Unidad',
  esMayorDeEdad: false,
  deudaTotal: 0,
  campamentos: [],
  inscripcionesGrupo: [],
  inscripcionesScout: [],
  documentacionPersonal: null,
  documentacionInscripcion: [],
  ...over,
});

describe('coincideConBusqueda', () => {
  it('sin texto coincide con todos', () => {
    expect(coincideConBusqueda('Ana', undefined)).toBe(true);
    expect(coincideConBusqueda('Ana', '   ')).toBe(true);
  });

  it('ignora mayúsculas y tildes, y busca por fragmento en cualquier parte', () => {
    expect(coincideConBusqueda('Oficialdegui, Martín', 'martin')).toBe(true);
    expect(coincideConBusqueda('Oficialdegui, Martín', 'OFICIAL')).toBe(true);
    expect(coincideConBusqueda('Oficialdegui, Martín', 'lopez')).toBe(false);
  });
});

describe('acotarAOrigen', () => {
  const mixta = persona({
    deudaTotal: 42000,
    campamentos: [
      camp(),
      camp({ campamentoId: 'c2', nombre: 'Otro', saldo: 0 }),
    ],
    inscripcionesGrupo: [insc()],
  });

  it('sin origen devuelve la deuda intacta', () => {
    expect(acotarAOrigen(mixta, {})).toBe(mixta);
    expect(acotarAOrigen(mixta, { tipo: TipoDeudaFilter.DINERO })).toBe(mixta);
    expect(acotarAOrigen(mixta, { tipo: TipoDeudaFilter.DOCUMENTACION })).toBe(
      mixta,
    );
  });

  it('por campamento deja solo ese campamento con saldo y recalcula el total', () => {
    const r = acotarAOrigen(mixta, { campamentoId: 'camp-inicio' });
    expect(r?.campamentos.map((c) => c.campamentoId)).toEqual(['camp-inicio']);
    expect(r?.inscripcionesGrupo).toEqual([]);
    expect(r?.deudaTotal).toBe(32000);
  });

  it('por campamento sin saldo en ese campamento descarta a la persona', () => {
    expect(acotarAOrigen(mixta, { campamentoId: 'c2' })).toBeNull();
    expect(acotarAOrigen(mixta, { campamentoId: 'inexistente' })).toBeNull();
  });

  it('tipo inscripcionesGrupo muestra solo esa deuda', () => {
    const r = acotarAOrigen(mixta, {
      tipo: TipoDeudaFilter.INSCRIPCIONES_GRUPO,
    });
    expect(r?.campamentos).toEqual([]);
    expect(r?.deudaTotal).toBe(10000);
  });

  it('tipo campamentos sin saldo de campamento descarta a la persona', () => {
    const soloInsc = persona({
      deudaTotal: 10000,
      inscripcionesGrupo: [insc()],
    });
    expect(
      acotarAOrigen(soloInsc, { tipo: TipoDeudaFilter.CAMPAMENTOS }),
    ).toBeNull();
  });

  it('no muta la deuda original', () => {
    acotarAOrigen(mixta, { campamentoId: 'camp-inicio' });
    expect(mixta.campamentos).toHaveLength(2);
    expect(mixta.deudaTotal).toBe(42000);
  });
});

describe('buildConsolidado', () => {
  const deudas = [
    persona({
      personaId: 'a',
      deudaTotal: 42000,
      campamentos: [camp()],
      inscripcionesGrupo: [insc({ inscripcionId: 'i-a' })],
    }),
    persona({
      personaId: 'b',
      deudaTotal: 20000,
      campamentos: [camp({ saldo: 20000 })],
    }),
    persona({
      personaId: 'c',
      deudaTotal: 5000,
      inscripcionesScout: [
        insc({ tipo: 'scout_argentina', ano: 2025, saldo: 5000 }),
      ],
    }),
    // Solo debe papeles: no suma a ningún total de plata.
    persona({ personaId: 'd', deudaTotal: 0 }),
  ];

  it('totaliza por origen y cuenta personas con deuda de plata', () => {
    const r = buildConsolidado(deudas);
    expect(r.personasConDeuda).toBe(3);
    expect(r.deudaTotal).toBe(67000);
    expect(r.deudaCampamentos).toBe(52000);
    expect(r.deudaInscripcionesGrupo).toBe(10000);
    expect(r.deudaInscripcionesScout).toBe(5000);
  });

  it('lista cada campamento e inscripción con deuda, con su valor de filtro', () => {
    const r = buildConsolidado(deudas);
    expect(r.campamentos).toEqual([
      {
        campamentoId: 'camp-inicio',
        nombre: 'Campamento de Inicio',
        ano: 2026,
        deudaTotal: 52000,
        personasConDeuda: 2,
      },
    ]);
    expect(r.inscripciones).toEqual([
      {
        tipo: TipoDeudaFilter.INSCRIPCIONES_GRUPO,
        ano: 2026,
        deudaTotal: 10000,
        personasConDeuda: 1,
      },
      {
        tipo: TipoDeudaFilter.INSCRIPCIONES_SCOUT,
        ano: 2025,
        deudaTotal: 5000,
        personasConDeuda: 1,
      },
    ]);
  });

  it('un origen que ya no registra deuda deja de aparecer', () => {
    const saldado = persona({
      deudaTotal: 0,
      campamentos: [camp({ saldo: 0, autorizacionEntregada: false })],
    });
    const r = buildConsolidado([saldado]);
    expect(r.campamentos).toEqual([]);
    expect(r.inscripciones).toEqual([]);
    expect(r.deudaTotal).toBe(0);
  });
});
