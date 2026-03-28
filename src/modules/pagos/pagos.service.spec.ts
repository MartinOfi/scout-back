import { Test, TestingModule } from '@nestjs/testing';
import { PagosService } from './pagos.service';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { EntityManager } from 'typeorm';
import { MedioPago, ConceptoMovimiento, CajaType } from '../../common/enums';
import { BadRequestException } from '@nestjs/common';

describe('PagosService', () => {
  let service: PagosService;
  let cajasService: jest.Mocked<CajasService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let mockManager: jest.Mocked<EntityManager>;

  const mockCajaGrupo = {
    id: 'caja-grupo-id',
    tipo: CajaType.GRUPO,
  };

  const mockCajaPersonal = {
    id: 'caja-personal-id',
    tipo: CajaType.PERSONAL,
    propietarioId: 'persona-id',
  };

  beforeEach(async () => {
    mockManager = {
      create: jest.fn().mockImplementation((_, data) => ({
        id: 'new-mov-id',
        ...data,
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    } as unknown as jest.Mocked<EntityManager>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        {
          provide: CajasService,
          useValue: {
            findCajaGrupo: jest.fn().mockResolvedValue(mockCajaGrupo),
            findCajaPersonal: jest.fn().mockResolvedValue(mockCajaPersonal),
          },
        },
        {
          provide: MovimientosService,
          useValue: {
            calcularSaldo: jest.fn().mockResolvedValue(10000),
          },
        },
      ],
    }).compile();

    service = module.get<PagosService>(PagosService);
    cajasService = module.get(CajasService);
    movimientosService = module.get(MovimientosService);
  });

  describe('ejecutarPagoConManager', () => {
    it('debería crear solo INGRESO cuando montoConSaldoPersonal es 0', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 0,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        inscripcionId: 'inscripcion-id',
      });

      expect(result.movimientoEgresoPersonal).toBeUndefined();
      expect(result.movimientoIngreso).toBeDefined();
      expect(result.movimientoIngreso.monto).toBe(5000);
      expect(result.desglose.montoSaldoPersonal).toBe(0);
      expect(result.desglose.montoFisico).toBe(5000);
    });

    it('debería crear EGRESO + INGRESO cuando usa saldo personal', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 3000,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        inscripcionId: 'inscripcion-id',
      });

      expect(result.movimientoEgresoPersonal).toBeDefined();
      expect(result.movimientoEgresoPersonal?.monto).toBe(3000);
      expect(result.movimientoIngreso.monto).toBe(5000);
      expect(result.desglose.montoSaldoPersonal).toBe(3000);
      expect(result.desglose.montoFisico).toBe(2000);
    });

    it('debería usar medioPago efectivo por defecto', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 0,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
      });

      expect(result.movimientoIngreso.medioPago).toBe(MedioPago.EFECTIVO);
    });

    it('debería usar medioPago saldo_personal cuando es 100% saldo', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 5000,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
      });

      expect(result.movimientoIngreso.medioPago).toBe(MedioPago.SALDO_PERSONAL);
    });

    it('debería usar medioPago MIXTO cuando combina efectivo y saldo personal', async () => {
      const result = await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 2000,
        medioPago: MedioPago.EFECTIVO,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
      });

      expect(result.movimientoIngreso.medioPago).toBe(MedioPago.MIXTO);
      expect(result.desglose.montoFisico).toBe(3000);
      expect(result.desglose.montoSaldoPersonal).toBe(2000);
    });

    it('debería incluir desglose en descripción cuando es pago mixto', async () => {
      await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 5000,
        montoConSaldoPersonal: 2000,
        medioPago: MedioPago.EFECTIVO,
        concepto: ConceptoMovimiento.CAMPAMENTO_PAGO,
        descripcion: 'Pago campamento verano',
      });

      // Verificar que el movimiento de ingreso tiene la descripción con desglose
      const createCalls = mockManager.create.mock.calls;
      // El segundo create es el de ingreso (el primero es egreso personal)
      const ingresoCall = createCalls.find(
        (call) => call[1].tipo === 'ingreso',
      );
      expect(ingresoCall).toBeDefined();
      expect(ingresoCall![1].descripcion).toContain('efectivo: $3000');
      expect(ingresoCall![1].descripcion).toContain('saldo personal: $2000');
    });

    it('debería usar medioPago MIXTO con transferencia y saldo personal', async () => {
      await service.ejecutarPagoConManager(mockManager, {
        personaId: 'persona-id',
        montoTotal: 10000,
        montoConSaldoPersonal: 4000,
        medioPago: MedioPago.TRANSFERENCIA,
        concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        descripcion: 'Pago inscripción',
      });

      const ingresoCall = mockManager.create.mock.calls.find(
        (call) => call[1].tipo === 'ingreso',
      );
      expect(ingresoCall![1].medioPago).toBe(MedioPago.MIXTO);
      expect(ingresoCall![1].descripcion).toContain('transferencia: $6000');
      expect(ingresoCall![1].descripcion).toContain('saldo personal: $4000');
    });

    it('debería fallar si persona no tiene caja personal', async () => {
      cajasService.findCajaPersonal.mockResolvedValue(null);

      await expect(
        service.ejecutarPagoConManager(mockManager, {
          personaId: 'persona-id',
          montoTotal: 5000,
          montoConSaldoPersonal: 3000,
          concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debería fallar si saldo insuficiente', async () => {
      movimientosService.calcularSaldo.mockResolvedValue(1000);

      await expect(
        service.ejecutarPagoConManager(mockManager, {
          personaId: 'persona-id',
          montoTotal: 5000,
          montoConSaldoPersonal: 3000,
          concepto: ConceptoMovimiento.INSCRIPCION_GRUPO,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
