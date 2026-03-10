/**
 * Test Data Factory - Builder Pattern for Test Entities
 * Provides convenient methods to create test data with sensible defaults
 */

import { DataSource } from 'typeorm';
import {
  PersonaType,
  EstadoPersona,
  Rama,
  MedioPago,
  TipoMovimiento,
  ConceptoMovimiento,
  EstadoPago,
  CajaType,
  CargoEducador,
} from '../../src/common/enums';

/**
 * Base factory configuration
 */
interface FactoryOptions {
  dataSource: DataSource;
}

/**
 * Factory for creating test Protagonistas
 */
export class ProtagonistaFactory {
  constructor(private options: FactoryOptions) {}

  async create(overrides: Partial<any> = {}): Promise<any> {
    const repository = this.options.dataSource.getRepository('Persona');

    const defaultData = {
      nombre: 'Juan',
      apellido: 'Test',
      dni: this.generateRandomDNI(),
      fechaNacimiento: new Date('2010-05-15'),
      tipo: PersonaType.PROTAGONISTA,
      estado: EstadoPersona.ACTIVO,
      rama: Rama.MANADA,
      fechaIngreso: new Date(),
      fueBonificado: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const persona = repository.create({
      ...defaultData,
      ...overrides,
    });

    return await repository.save(persona);
  }

  /**
   * Create multiple protagonistas at once
   */
  async createMany(
    count: number,
    overrides: Partial<any> = {},
  ): Promise<any[]> {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        this.create({
          nombre: `Protagonista ${i + 1}`,
          dni: this.generateRandomDNI(),
          ...overrides,
        }),
      );
    }
    return Promise.all(promises);
  }

  private generateRandomDNI(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }
}

/**
 * Factory for creating test Educadores
 */
export class EducadorFactory {
  constructor(private options: FactoryOptions) {}

  async create(overrides: Partial<any> = {}): Promise<any> {
    const repository = this.options.dataSource.getRepository('Persona');

    const defaultData = {
      nombre: 'Maria',
      apellido: 'Educadora',
      dni: this.generateRandomDNI(),
      fechaNacimiento: new Date('1990-03-20'),
      tipo: PersonaType.EDUCADOR,
      estado: EstadoPersona.ACTIVO,
      cargo: CargoEducador.EDUCADOR,
      fechaIngreso: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const persona = repository.create({
      ...defaultData,
      ...overrides,
    });

    return await repository.save(persona);
  }

  private generateRandomDNI(): string {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }
}

/**
 * Factory for creating test Campamentos
 */
export class CampamentoFactory {
  constructor(private options: FactoryOptions) {}

  async create(overrides: Partial<any> = {}): Promise<any> {
    const repository = this.options.dataSource.getRepository('Campamento');

    const defaultData = {
      nombre: 'Campamento Test',
      descripcion: 'Campamento de prueba',
      fechaInicio: new Date('2026-07-01'),
      fechaFin: new Date('2026-07-07'),
      costoPorPersona: 15000,
      cuotasBase: 3,
      participantes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const campamento = repository.create({
      ...defaultData,
      ...overrides,
    });

    return await repository.save(campamento);
  }
}

/**
 * Factory for creating test Movimientos
 */
export class MovimientoFactory {
  constructor(private options: FactoryOptions) {}

  async create(overrides: Partial<any> = {}): Promise<any> {
    const repository = this.options.dataSource.getRepository('Movimiento');

    const defaultData = {
      cajaId: await this.getOrCreateCajaGrupo(),
      tipo: TipoMovimiento.INGRESO,
      monto: 5000,
      concepto: ConceptoMovimiento.CUOTA_GRUPO,
      descripcion: 'Movimiento de test',
      responsableId: null,
      medioPago: MedioPago.EFECTIVO,
      requiereComprobante: false,
      estadoPago: EstadoPago.PAGADO,
      fecha: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const movimiento = repository.create({
      ...defaultData,
      ...overrides,
    });

    return await repository.save(movimiento);
  }

  private async getOrCreateCajaGrupo(): Promise<string> {
    const cajaRepo = this.options.dataSource.getRepository('Caja');

    let caja = await cajaRepo.findOne({
      where: { tipo: CajaType.GRUPO },
    });

    if (!caja) {
      caja = cajaRepo.create({
        tipo: CajaType.GRUPO,
        nombre: 'Caja Grupo',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      caja = await cajaRepo.save(caja);
    }

    return caja.id;
  }
}

/**
 * Factory for creating test Eventos
 */
export class EventoFactory {
  constructor(private options: FactoryOptions) {}

  async create(overrides: Partial<any> = {}): Promise<any> {
    const repository = this.options.dataSource.getRepository('Evento');

    const defaultData = {
      nombre: 'Evento Test',
      descripcion: 'Evento de prueba',
      fecha: new Date('2026-09-15'),
      productos: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const evento = repository.create({
      ...defaultData,
      ...overrides,
    });

    return await repository.save(evento);
  }
}

/**
 * Main factory class that provides access to all entity factories
 */
export class TestDataFactory {
  readonly protagonista: ProtagonistaFactory;
  readonly educador: EducadorFactory;
  readonly campamento: CampamentoFactory;
  readonly movimiento: MovimientoFactory;
  readonly evento: EventoFactory;

  constructor(dataSource: DataSource) {
    const options = { dataSource };
    this.protagonista = new ProtagonistaFactory(options);
    this.educador = new EducadorFactory(options);
    this.campamento = new CampamentoFactory(options);
    this.movimiento = new MovimientoFactory(options);
    this.evento = new EventoFactory(options);
  }
}

/**
 * Convenience function to create factory instance
 */
export function createTestDataFactory(dataSource: DataSource): TestDataFactory {
  return new TestDataFactory(dataSource);
}
