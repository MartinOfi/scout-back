import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CajasService } from './cajas.service';
import { Caja } from './entities/caja.entity';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { InscripcionesService } from '../inscripciones/inscripciones.service';
import { CuotasService } from '../cuotas/cuotas.service';
import { CampamentosService } from '../campamentos/campamentos.service';
import { CajaType } from '../../common/enums';

describe('CajasService', () => {
  let service: CajasService;
  let cajaRepository: jest.Mocked<Repository<Caja>>;
  let deletionValidator: jest.Mocked<DeletionValidatorService>;
  let movimientosService: jest.Mocked<MovimientosService>;
  let inscripcionesService: jest.Mocked<InscripcionesService>;
  let cuotasService: jest.Mocked<CuotasService>;
  let dataSource: jest.Mocked<DataSource>;
  let campamentosService: jest.Mocked<CampamentosService>;

  const mockCajaGrupo: Partial<Caja> = {
    id: 'caja-grupo-uuid',
    nombre: 'Caja del Grupo',
    tipo: CajaType.GRUPO,
    propietarioId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCajaRama: Partial<Caja> = {
    id: 'caja-rama-uuid',
    nombre: 'Fondo Manada',
    tipo: CajaType.RAMA_MANADA,
    propietarioId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCajaPersonal: Partial<Caja> = {
    id: 'caja-personal-uuid',
    nombre: 'Cuenta Personal - Juan',
    tipo: CajaType.PERSONAL,
    propietarioId: 'persona-uuid',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockCajaRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockDeletionValidator = {
      canDeleteCaja: jest.fn().mockResolvedValue({ canDelete: true }),
    };

    const mockMovimientosService = {
      calcularSaldo: jest.fn().mockResolvedValue(0),
      calcularSaldosBatch: jest.fn().mockResolvedValue(
        new Map([
          ['caja-grupo-uuid', 5000],
          ['caja-rama-uuid', 1000],
          ['caja-personal-uuid', 200],
        ]),
      ),
      findReembolsosPendientes: jest.fn().mockResolvedValue([]),
      getReembolsosPendientesResumen: jest
        .fn()
        .mockResolvedValue({ total: 0, cantidad: 0 }),
    };

    const mockInscripcionesService = {
      getTotalDeudaInscripciones: jest
        .fn()
        .mockResolvedValue({ total: 0, cantidad: 0 }),
    };

    const mockCuotasService = {
      getTotalDeudaCuotas: jest
        .fn()
        .mockResolvedValue({ total: 0, cantidad: 0 }),
    };

    const mockCampamentosService = {
      getTotalDeudaCampamentos: jest
        .fn()
        .mockResolvedValue({ total: 0, cantidad: 0 }),
    };

    const mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajasService,
        {
          provide: getRepositoryToken(Caja),
          useValue: mockCajaRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: DeletionValidatorService,
          useValue: mockDeletionValidator,
        },
        {
          provide: MovimientosService,
          useValue: mockMovimientosService,
        },
        {
          provide: InscripcionesService,
          useValue: mockInscripcionesService,
        },
        {
          provide: CuotasService,
          useValue: mockCuotasService,
        },
        {
          provide: CampamentosService,
          useValue: mockCampamentosService,
        },
      ],
    }).compile();

    service = module.get<CajasService>(CajasService);
    cajaRepository = module.get(getRepositoryToken(Caja));
    dataSource = module.get(DataSource);
    deletionValidator = module.get(DeletionValidatorService);
    movimientosService = module.get(MovimientosService);
    inscripcionesService = module.get(InscripcionesService);
    cuotasService = module.get(CuotasService);
    campamentosService = module.get(CampamentosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a caja with saldoActual when found', async () => {
      cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);
      movimientosService.calcularSaldo.mockResolvedValue(1500);

      const result = await service.findOne('caja-personal-uuid');

      expect(result.id).toBe('caja-personal-uuid');
      expect(result.tipo).toBe(CajaType.PERSONAL);
      expect(result.nombre).toBe('Cuenta Personal - Juan');
      expect(result.saldoActual).toBe(1500);
      expect(cajaRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'caja-personal-uuid' },
        relations: ['propietario'],
      });
      expect(movimientosService.calcularSaldo).toHaveBeenCalledWith(
        'caja-personal-uuid',
      );
    });

    it('should throw NotFoundException when caja not found', async () => {
      cajaRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    describe('validation', () => {
      it('should throw BadRequestException when trying to delete caja de grupo', async () => {
        cajaRepository.findOne.mockResolvedValue(mockCajaGrupo as Caja);

        await expect(service.remove('caja-grupo-uuid')).rejects.toThrow(
          BadRequestException,
        );
        await expect(service.remove('caja-grupo-uuid')).rejects.toThrow(
          /No se puede eliminar la caja del grupo/,
        );
        expect(deletionValidator.canDeleteCaja).not.toHaveBeenCalled();
        expect(cajaRepository.softRemove).not.toHaveBeenCalled();
      });

      it('should throw NotFoundException when caja does not exist', async () => {
        cajaRepository.findOne.mockResolvedValue(null);

        await expect(service.remove('non-existent-id')).rejects.toThrow(
          NotFoundException,
        );
        expect(deletionValidator.canDeleteCaja).not.toHaveBeenCalled();
      });

      it('should throw BadRequestException when caja has movements', async () => {
        cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);
        deletionValidator.canDeleteCaja.mockResolvedValue({
          canDelete: false,
          reason: 'No se puede eliminar: la caja tiene 5 movimiento(s)',
          movementCount: 5,
        });

        await expect(service.remove('caja-personal-uuid')).rejects.toThrow(
          BadRequestException,
        );
        expect(cajaRepository.softRemove).not.toHaveBeenCalled();
      });
    });

    describe('successful deletion', () => {
      it('should soft remove caja personal when no movements exist', async () => {
        cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);
        deletionValidator.canDeleteCaja.mockResolvedValue({ canDelete: true });
        cajaRepository.softRemove.mockResolvedValue(mockCajaPersonal as Caja);

        await service.remove('caja-personal-uuid');

        expect(deletionValidator.canDeleteCaja).toHaveBeenCalledWith(
          'caja-personal-uuid',
        );
        expect(cajaRepository.softRemove).toHaveBeenCalledWith(
          mockCajaPersonal,
        );
      });

      it('should soft remove caja de rama when no movements exist', async () => {
        cajaRepository.findOne.mockResolvedValue(mockCajaRama as Caja);
        deletionValidator.canDeleteCaja.mockResolvedValue({ canDelete: true });
        cajaRepository.softRemove.mockResolvedValue(mockCajaRama as Caja);

        await service.remove('caja-rama-uuid');

        expect(deletionValidator.canDeleteCaja).toHaveBeenCalledWith(
          'caja-rama-uuid',
        );
        expect(cajaRepository.softRemove).toHaveBeenCalledWith(mockCajaRama);
      });
    });
  });

  describe('findCajaGrupo', () => {
    it('should return the group caja with saldoActual', async () => {
      cajaRepository.findOne.mockResolvedValue(mockCajaGrupo as Caja);
      movimientosService.calcularSaldo.mockResolvedValue(25000);

      const result = await service.findCajaGrupo();

      expect(result.id).toBe('caja-grupo-uuid');
      expect(result.tipo).toBe(CajaType.GRUPO);
      expect(result.nombre).toBe('Caja del Grupo');
      expect(result.saldoActual).toBe(25000);
      expect(cajaRepository.findOne).toHaveBeenCalledWith({
        where: { tipo: CajaType.GRUPO },
      });
      expect(movimientosService.calcularSaldo).toHaveBeenCalledWith(
        'caja-grupo-uuid',
      );
    });

    it('should throw NotFoundException when group caja does not exist', async () => {
      cajaRepository.findOne.mockResolvedValue(null);

      await expect(service.findCajaGrupo()).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCajaPersonal', () => {
    it('should return personal caja for a propietario', async () => {
      cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);

      const result = await service.findCajaPersonal('persona-uuid');

      expect(result).toEqual(mockCajaPersonal);
      expect(cajaRepository.findOne).toHaveBeenCalledWith({
        where: { tipo: CajaType.PERSONAL, propietarioId: 'persona-uuid' },
        relations: ['propietario'],
      });
    });

    it('should return null when personal caja does not exist', async () => {
      cajaRepository.findOne.mockResolvedValue(null);

      const result = await service.findCajaPersonal('non-existent-persona');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a personal caja', async () => {
      const dto = {
        tipo: CajaType.PERSONAL,
        propietarioId: 'new-persona-uuid',
      };

      const created = {
        id: 'new-caja-uuid',
        nombre: 'Cuenta Personal',
        ...dto,
      };

      cajaRepository.findOne.mockResolvedValue(null);
      cajaRepository.create.mockReturnValue(created as Caja);
      cajaRepository.save.mockResolvedValue(created as Caja);

      const result = await service.create(dto);

      expect(result.tipo).toBe(CajaType.PERSONAL);
      expect(cajaRepository.create).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException when creating second grupo caja', async () => {
      const dto = { tipo: CajaType.GRUPO };

      cajaRepository.findOne.mockResolvedValue(mockCajaGrupo as Caja);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /Ya existe una caja de grupo/,
      );
    });

    it('should throw BadRequestException when personal caja without propietario', async () => {
      const dto = { tipo: CajaType.PERSONAL };

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /cajas personales requieren un propietario/,
      );
    });

    it('should throw BadRequestException when persona already has personal caja', async () => {
      const dto = {
        tipo: CajaType.PERSONAL,
        propietarioId: 'persona-uuid',
      };

      cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      await expect(service.create(dto)).rejects.toThrow(
        /ya tiene una caja personal/,
      );
    });
  });

  describe('getOrCreateCajaPersonal', () => {
    it('should return existing personal caja', async () => {
      cajaRepository.findOne.mockResolvedValue(mockCajaPersonal as Caja);

      const result = await service.getOrCreateCajaPersonal('persona-uuid');

      expect(result).toEqual(mockCajaPersonal);
      expect(cajaRepository.create).not.toHaveBeenCalled();
    });

    it('should create new personal caja when none exists', async () => {
      const newCaja = {
        id: 'new-caja-uuid',
        tipo: CajaType.PERSONAL,
        propietarioId: 'new-persona-uuid',
        nombre: 'Cuenta Personal - Juan Scout',
      };

      cajaRepository.findOne.mockResolvedValue(null);
      cajaRepository.create.mockReturnValue(newCaja as Caja);
      cajaRepository.save.mockResolvedValue(newCaja as Caja);

      const result = await service.getOrCreateCajaPersonal(
        'new-persona-uuid',
        'Juan Scout',
      );

      expect(cajaRepository.create).toHaveBeenCalledWith({
        tipo: CajaType.PERSONAL,
        propietarioId: 'new-persona-uuid',
        nombre: 'Cuenta Personal - Juan Scout',
      });
      expect(cajaRepository.save).toHaveBeenCalled();
      expect(result.tipo).toBe(CajaType.PERSONAL);
      expect(result.nombre).toBe('Cuenta Personal - Juan Scout');
    });
  });

  describe('findByTipo', () => {
    it('should return cajas filtered by tipo', async () => {
      cajaRepository.find.mockResolvedValue([mockCajaRama as Caja]);

      const result = await service.findByTipo(CajaType.RAMA_MANADA);

      expect(result).toHaveLength(1);
      expect(cajaRepository.find).toHaveBeenCalledWith({
        where: { tipo: CajaType.RAMA_MANADA },
        relations: ['propietario'],
      });
    });
  });

  describe('findAll', () => {
    it('should return all cajas ordered by tipo and nombre', async () => {
      const cajas = [mockCajaGrupo, mockCajaRama, mockCajaPersonal];
      cajaRepository.find.mockResolvedValue(cajas as Caja[]);

      const result = await service.findAll();

      expect(result).toHaveLength(3);
      expect(cajaRepository.find).toHaveBeenCalledWith({
        relations: ['propietario'],
        order: { tipo: 'ASC', nombre: 'ASC' },
      });
    });

    it('should use calcularSaldosBatch instead of individual calcularSaldo calls', async () => {
      const cajas = [mockCajaGrupo, mockCajaRama, mockCajaPersonal];
      cajaRepository.find.mockResolvedValue(cajas as Caja[]);
      movimientosService.calcularSaldosBatch.mockResolvedValue(
        new Map([
          ['caja-grupo-uuid', 5000],
          ['caja-rama-uuid', 1000],
          ['caja-personal-uuid', 200],
        ]),
      );

      const result = await service.findAll();

      expect(movimientosService.calcularSaldosBatch).toHaveBeenCalledWith([
        'caja-grupo-uuid',
        'caja-rama-uuid',
        'caja-personal-uuid',
      ]);
      expect(movimientosService.calcularSaldo).not.toHaveBeenCalled();
      expect(result[0].saldoActual).toBe(5000);
      expect(result[1].saldoActual).toBe(1000);
      expect(result[2].saldoActual).toBe(200);
    });

    it('should return empty array when no cajas exist', async () => {
      cajaRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
      expect(movimientosService.calcularSaldosBatch).not.toHaveBeenCalled();
    });
  });

  describe('getConsolidadoSaldos', () => {
    const mockCajaRamaManada = {
      id: 'caja-rama-manada-uuid',
      tipo: CajaType.RAMA_MANADA,
      nombre: 'Fondo Manada',
    } as Caja;

    const mockCajaRamaUnidad = {
      id: 'caja-rama-unidad-uuid',
      tipo: CajaType.RAMA_UNIDAD,
      nombre: 'Fondo Unidad',
    } as Caja;

    beforeEach(() => {
      // Reset mocks for consolidado tests
      cajaRepository.findOne.mockReset();
      cajaRepository.find.mockReset();
    });

    it('should return consolidado with all saldos and deudas', async () => {
      // CTE query returns all data in one shot
      dataSource.query.mockResolvedValue([
        {
          cajas: [
            {
              id: 'caja-grupo-uuid',
              tipo: CajaType.GRUPO,
              nombre: 'Caja del Grupo',
              saldo: 10000,
            },
            {
              id: 'caja-rama-manada-uuid',
              tipo: CajaType.RAMA_MANADA,
              nombre: 'Fondo Manada',
              saldo: 2000,
            },
            {
              id: 'caja-rama-unidad-uuid',
              tipo: CajaType.RAMA_UNIDAD,
              nombre: 'Fondo Unidad',
              saldo: 3000,
            },
            {
              id: 'caja-personal-uuid',
              tipo: CajaType.PERSONAL,
              nombre: 'Cuenta Personal',
              saldo: 500,
            },
          ],
          reembolsos: { total: 1000, cantidad: 1 },
          deuda_inscripciones: { total: 5000, cantidad: 10 },
          deuda_cuotas: { total: 8000, cantidad: 20 },
          deuda_campamentos: { total: 3000, cantidad: 5 },
        },
      ]);

      const result = await service.getConsolidadoSaldos();

      // Verify structure
      expect(result.fecha).toBeDefined();
      expect(result.resumen).toBeDefined();
      expect(result.cajaGrupo).toBeDefined();
      expect(result.fondosRama).toBeDefined();
      expect(result.cuentasPersonales).toBeDefined();
      expect(result.reembolsosPendientes).toBeDefined();
      expect(result.deudasTotales).toBeDefined();

      // Verify values
      expect(result.cajaGrupo.saldo).toBe(10000);
      expect(result.fondosRama.total).toBe(5000); // 2000 + 3000
      expect(result.fondosRama.detalle).toHaveLength(2);
      expect(result.cuentasPersonales.total).toBe(500);
      expect(result.cuentasPersonales.cantidad).toBe(1);
      expect(result.reembolsosPendientes.total).toBe(1000);
      expect(result.reembolsosPendientes.cantidad).toBe(1);

      // Verify deudas
      expect(result.deudasTotales.total).toBe(16000); // 5000 + 8000 + 3000
      expect(result.deudasTotales.inscripciones.total).toBe(5000);
      expect(result.deudasTotales.cuotas.total).toBe(8000);
      expect(result.deudasTotales.campamentos.total).toBe(3000);

      // Verify resumen calculations
      const totalGeneral = 10000 + 5000 + 500; // grupo + ramas + personales
      expect(result.resumen.totalGeneral).toBe(totalGeneral);
      expect(result.resumen.totalDisponible).toBe(totalGeneral - 1000); // - reembolsos
      expect(result.resumen.totalPorCobrar).toBe(16000);

      // Verify single query was used
      expect(dataSource.query).toHaveBeenCalledTimes(1);
    });

    it('should handle empty cajas gracefully', async () => {
      dataSource.query.mockResolvedValue([
        {
          cajas: null,
          reembolsos: { total: 0, cantidad: 0 },
          deuda_inscripciones: { total: 0, cantidad: 0 },
          deuda_cuotas: { total: 0, cantidad: 0 },
          deuda_campamentos: { total: 0, cantidad: 0 },
        },
      ]);

      const result = await service.getConsolidadoSaldos();

      expect(result.cajaGrupo.id).toBe('');
      expect(result.cajaGrupo.saldo).toBe(0);
      expect(result.fondosRama.total).toBe(0);
      expect(result.fondosRama.detalle).toHaveLength(0);
      expect(result.cuentasPersonales.total).toBe(0);
      expect(result.cuentasPersonales.cantidad).toBe(0);
      expect(result.resumen.totalGeneral).toBe(0);
      expect(result.resumen.totalDisponible).toBe(0);
      expect(result.resumen.totalPorCobrar).toBe(0);
    });

    it('should use rama type as nombre when caja has no nombre', async () => {
      dataSource.query.mockResolvedValue([
        {
          cajas: [
            {
              id: 'caja-rama-uuid',
              tipo: CajaType.RAMA_MANADA,
              nombre: null,
              saldo: 1000,
            },
          ],
          reembolsos: { total: 0, cantidad: 0 },
          deuda_inscripciones: { total: 0, cantidad: 0 },
          deuda_cuotas: { total: 0, cantidad: 0 },
          deuda_campamentos: { total: 0, cantidad: 0 },
        },
      ]);

      const result = await service.getConsolidadoSaldos();

      expect(result.fondosRama.detalle[0].nombre).toBe('Fondo Manada');
    });
  });
});
