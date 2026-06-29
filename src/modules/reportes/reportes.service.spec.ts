import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportesService } from './reportes.service';
import { Protagonista, Educador } from '../personas/entities/persona.entity';
import { CampamentoParticipante } from '../campamentos/entities/campamento-participante.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Cuota } from '../cuotas/entities/cuota.entity';
import { PersonaType, TipoInscripcion, Rama } from '../../common/enums';

/**
 * Datos que devuelve cada repositorio mockeado en una corrida de getDeudas.
 */
interface SetupData {
  protagonistas?: unknown[];
  educadores?: unknown[];
  inscripciones?: unknown[];
  participaciones?: unknown[];
  cuotas?: unknown[];
}

/** Query builder encadenable cuyo getMany resuelve un valor fijo. */
function makeRepo(getManyValue: unknown[]) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getManyValue),
  };
  return { createQueryBuilder: jest.fn(() => qb) };
}

async function buildService(data: SetupData): Promise<ReportesService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReportesService,
      {
        provide: getRepositoryToken(Protagonista),
        useValue: makeRepo(data.protagonistas ?? []),
      },
      {
        provide: getRepositoryToken(Educador),
        useValue: makeRepo(data.educadores ?? []),
      },
      {
        provide: getRepositoryToken(CampamentoParticipante),
        useValue: makeRepo(data.participaciones ?? []),
      },
      // movimientoRepository solo se usa para pagos: vacío => saldo completo.
      { provide: getRepositoryToken(Movimiento), useValue: makeRepo([]) },
      {
        provide: getRepositoryToken(Inscripcion),
        useValue: makeRepo(data.inscripciones ?? []),
      },
      {
        provide: getRepositoryToken(Cuota),
        useValue: makeRepo(data.cuotas ?? []),
      },
    ],
  }).compile();

  return module.get<ReportesService>(ReportesService);
}

const inscripcionScout = (over: Record<string, unknown>) => ({
  id: 'insc',
  personaId: 'x',
  tipo: TipoInscripcion.SCOUT_ARGENTINA,
  ano: 2026,
  montoTotal: 5000,
  montoBonificado: 0,
  declaracionDeSalud: true,
  autorizacionDeImagen: true,
  salidasCercanas: true,
  autorizacionIngreso: true,
  certificadoAptitudFisica: true,
  ...over,
});

describe('ReportesService', () => {
  it('incluye educadores con deuda: rama "Educadores", esMayorDeEdad y sin documentación personal', async () => {
    const service = await buildService({
      educadores: [
        { id: 'edu-1', nombre: 'Ana', tipo: PersonaType.EDUCADOR, rama: null },
      ],
      inscripciones: [
        inscripcionScout({ id: 'i-edu', personaId: 'edu-1', montoTotal: 5000 }),
      ],
    });

    const result = await service.getDeudas({});

    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe('Ana');
    expect(result[0].rama).toBe('Educadores');
    expect(result[0].esMayorDeEdad).toBe(true);
    expect(result[0].documentacionPersonal).toBeNull();
    expect(result[0].deudaTotal).toBe(5000);
  });

  it('protagonista menor: el DNI de los padres faltante genera deuda documental', async () => {
    const service = await buildService({
      protagonistas: [
        {
          id: 'p-uni',
          nombre: 'Beto',
          tipo: PersonaType.PROTAGONISTA,
          rama: Rama.UNIDAD,
          dni: true,
          partidaNacimiento: true,
          dniPadres: false,
          carnetObraSocial: true,
        },
      ],
    });

    const result = await service.getDeudas({});

    expect(result).toHaveLength(1);
    expect(result[0].esMayorDeEdad).toBe(false);
    expect(result[0].documentacionPersonal?.dniPadres).toBe(false);
  });

  it('a un Rover al que solo le falta el DNI de los padres no se le genera deuda (no aparece)', async () => {
    const service = await buildService({
      protagonistas: [
        {
          id: 'p-rov',
          nombre: 'Caro',
          tipo: PersonaType.PROTAGONISTA,
          rama: Rama.ROVERS,
          dni: true,
          partidaNacimiento: true,
          dniPadres: false,
          carnetObraSocial: true,
        },
      ],
    });

    const result = await service.getDeudas({});

    expect(result).toHaveLength(0);
  });

  it('Rover: DNI de padres se reporta entregado; partida/DNI/obra social sí cuentan', async () => {
    const service = await buildService({
      protagonistas: [
        {
          id: 'p-rov2',
          nombre: 'Dani',
          tipo: PersonaType.PROTAGONISTA,
          rama: Rama.ROVERS,
          dni: false, // genera deuda documental real
          partidaNacimiento: true,
          dniPadres: false, // exento -> se reporta true
          carnetObraSocial: true,
        },
      ],
    });

    const result = await service.getDeudas({});

    expect(result).toHaveLength(1);
    expect(result[0].esMayorDeEdad).toBe(true);
    expect(result[0].documentacionPersonal?.dni).toBe(false);
    expect(result[0].documentacionPersonal?.dniPadres).toBe(true);
  });

  it('Rover/Educador exentos de imagen, ingreso y salidas: no generan deuda de esos papeles', async () => {
    const service = await buildService({
      protagonistas: [
        {
          id: 'p-rov3',
          nombre: 'Eze',
          tipo: PersonaType.PROTAGONISTA,
          rama: Rama.ROVERS,
          dni: true,
          partidaNacimiento: true,
          dniPadres: true,
          carnetObraSocial: true,
        },
      ],
      inscripciones: [
        inscripcionScout({
          id: 'i-rov3',
          personaId: 'p-rov3',
          montoTotal: 3000, // deuda de dinero para que aparezca
          autorizacionDeImagen: false,
          autorizacionIngreso: false,
          salidasCercanas: false,
          declaracionDeSalud: true,
          certificadoAptitudFisica: true,
        }),
      ],
    });

    const result = await service.getDeudas({});

    expect(result).toHaveLength(1);
    expect(result[0].deudaTotal).toBe(3000);
    // Los papeles exentos no deben figurar como documentación faltante.
    expect(result[0].documentacionInscripcion).toHaveLength(0);
  });

  it('protagonista menor: imagen/ingreso/salidas faltantes sí generan deuda documental', async () => {
    const service = await buildService({
      protagonistas: [
        {
          id: 'p-uni2',
          nombre: 'Fran',
          tipo: PersonaType.PROTAGONISTA,
          rama: Rama.UNIDAD,
          dni: true,
          partidaNacimiento: true,
          dniPadres: true,
          carnetObraSocial: true,
        },
      ],
      inscripciones: [
        inscripcionScout({
          id: 'i-uni2',
          personaId: 'p-uni2',
          montoTotal: 0,
          montoBonificado: 0,
          autorizacionDeImagen: false,
        }),
      ],
    });

    const result = await service.getDeudas({});

    expect(result).toHaveLength(1);
    expect(result[0].documentacionInscripcion).toHaveLength(1);
    expect(result[0].documentacionInscripcion[0].autorizacionDeImagen).toBe(
      false,
    );
  });
});
