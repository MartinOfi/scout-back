import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { BonificacionesService } from './bonificaciones.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { CajaType, ConceptoMovimiento, TipoMovimiento } from '../../common/enums';

describe('BonificacionesService', () => {
  let service: BonificacionesService;
  let mockManager: jest.Mocked<EntityManager>;
  let cajasService: jest.Mocked<
    Pick<CajasService, 'findCajaGrupo' | 'findCajaFondoSolidario'>
  >;

  const mockCajaGrupo = { id: 'caja-grupo-id', tipo: CajaType.GRUPO };
  const mockCajaFondo = { id: 'caja-fondo-id', tipo: CajaType.FONDO_SOLIDARIO };

  beforeEach(async () => {
    mockManager = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FOR UPDATE')) {
          return Promise.resolve([{ id: 'caja-fondo-id' }]);
        }
        if (sql.includes('SUM')) {
          return Promise.resolve([{ saldo: '500000' }]);
        }
        return Promise.resolve([]);
      }),
      create: jest.fn().mockImplementation((_, data) => ({
        id: `mov-${data.tipo}`,
        ...data,
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EntityManager>;

    cajasService = {
      findCajaGrupo: jest.fn().mockResolvedValue(mockCajaGrupo),
      findCajaFondoSolidario: jest.fn().mockResolvedValue({
        ...mockCajaFondo,
        saldoActual: 500000,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BonificacionesService,
        { provide: CajasService, useValue: cajasService },
        {
          provide: MovimientosService,
          useValue: {
            // NO debe usarse para leer el saldo dentro de otorgarConManager.
            calcularSaldo: jest
              .fn()
              .mockRejectedValue(
                new Error('calcularSaldo no debe llamarse dentro de la transacción'),
              ),
            createWithManager: jest
              .fn()
              .mockImplementation(
                (manager: EntityManager, dto: Record<string, unknown>) =>
                  Promise.resolve(
                    manager.create('Movimiento' as never, dto as never),
                  ),
              ),
          },
        },
      ],
    }).compile();

    service = module.get<BonificacionesService>(BonificacionesService);
  });

  it('crea egreso del fondo e ingreso a la caja grupo, linkeados, sin llamar calcularSaldo', async () => {
    const result = await service.otorgarConManager(mockManager, {
      personaId: 'persona-id',
      monto: 5000,
      campamentoId: 'campamento-id',
    });

    const creates = (mockManager.create as jest.Mock).mock.calls;
    const egreso = creates.find((c) => c[1].tipo === TipoMovimiento.EGRESO)![1];
    const ingreso = creates.find((c) => c[1].tipo === TipoMovimiento.INGRESO)![1];

    expect(egreso.cajaId).toBe('caja-fondo-id');
    expect(egreso.concepto).toBe(ConceptoMovimiento.BONIFICACION_OTORGADA);
    expect(egreso.campamentoId).toBe('campamento-id');
    expect(ingreso.cajaId).toBe('caja-grupo-id');
    expect(ingreso.concepto).toBe(ConceptoMovimiento.BONIFICACION_RECIBIDA);
    expect(ingreso.campamentoId).toBe('campamento-id');

    expect(mockManager.update).toHaveBeenCalledTimes(2);
    expect(result.monto).toBe(5000);
    expect(result.saldoFondoRestante).toBe(495000);
  });

  it('no incluye campamentoId/inscripcionId cuando no se pasan', async () => {
    await service.otorgarConManager(mockManager, {
      personaId: 'persona-id',
      monto: 5000,
    });

    const creates = (mockManager.create as jest.Mock).mock.calls;
    const egreso = creates.find((c) => c[1].tipo === TipoMovimiento.EGRESO)![1];

    expect(egreso.campamentoId).toBeUndefined();
    expect(egreso.inscripcionId).toBeUndefined();
  });

  it('bloquea si el fondo no tiene saldo suficiente', async () => {
    (mockManager.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FOR UPDATE')) return Promise.resolve([{ id: 'caja-fondo-id' }]);
      if (sql.includes('SUM')) return Promise.resolve([{ saldo: '3000' }]);
      return Promise.resolve([]);
    });

    await expect(
      service.otorgarConManager(mockManager, { personaId: 'persona-id', monto: 5000 }),
    ).rejects.toThrow('El fondo solidario tiene $3000 disponibles, se requieren $5000');
  });

  it('bloquea si el monto no es positivo', async () => {
    await expect(
      service.otorgarConManager(mockManager, { personaId: 'persona-id', monto: 0 }),
    ).rejects.toThrow('El monto de la bonificación debe ser mayor a cero');
  });

  it('bloquea si no existe la caja de fondo solidario', async () => {
    cajasService.findCajaFondoSolidario.mockResolvedValue(null);

    await expect(
      service.otorgarConManager(mockManager, { personaId: 'persona-id', monto: 5000 }),
    ).rejects.toThrow('No existe la caja de fondo solidario');
  });

  it('toma el lock ANTES de leer el saldo', async () => {
    const orden: string[] = [];
    (mockManager.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FOR UPDATE')) {
        orden.push('lock');
        return Promise.resolve([{ id: 'caja-fondo-id' }]);
      }
      if (sql.includes('SUM')) {
        orden.push('saldo');
        return Promise.resolve([{ saldo: '500000' }]);
      }
      return Promise.resolve([]);
    });

    await service.otorgarConManager(mockManager, { personaId: 'persona-id', monto: 5000 });

    expect(orden).toEqual(['lock', 'saldo']);
  });

  it('bloquea si el fondo está exactamente en el límite y se pide más', async () => {
    (mockManager.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FOR UPDATE')) return Promise.resolve([{ id: 'caja-fondo-id' }]);
      if (sql.includes('SUM')) return Promise.resolve([{ saldo: '4999' }]);
      return Promise.resolve([]);
    });

    await expect(
      service.otorgarConManager(mockManager, { personaId: 'persona-id', monto: 5000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite otorgar exactamente el saldo disponible (borde)', async () => {
    (mockManager.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes('FOR UPDATE')) return Promise.resolve([{ id: 'caja-fondo-id' }]);
      if (sql.includes('SUM')) return Promise.resolve([{ saldo: '5000' }]);
      return Promise.resolve([]);
    });

    const result = await service.otorgarConManager(mockManager, {
      personaId: 'persona-id',
      monto: 5000,
    });

    expect(result.saldoFondoRestante).toBe(0);
  });
});
