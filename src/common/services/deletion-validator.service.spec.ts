import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeletionValidatorService } from './deletion-validator.service';
import { Movimiento } from '../../modules/movimientos/entities/movimiento.entity';

describe('DeletionValidatorService', () => {
  let service: DeletionValidatorService;
  let movimientoRepository: jest.Mocked<Repository<Movimiento>>;

  beforeEach(async () => {
    const mockRepository = {
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletionValidatorService,
        {
          provide: getRepositoryToken(Movimiento),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DeletionValidatorService>(DeletionValidatorService);
    movimientoRepository = module.get(getRepositoryToken(Movimiento));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('canDeletePersona', () => {
    it('should return canDelete=true when persona has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeletePersona('persona-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledTimes(2);
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { responsableId: 'persona-uuid' },
      });
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { personaAReembolsarId: 'persona-uuid' },
      });
    });

    it('should return canDelete=false when persona is responsable of movements', async () => {
      movimientoRepository.count
        .mockResolvedValueOnce(3) // as responsable
        .mockResolvedValueOnce(0); // as personaAReembolsar

      const result = await service.canDeletePersona('persona-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('responsable de 3 movimiento(s)');
      expect(result.movementCount).toBe(3);
    });

    it('should return canDelete=false when persona has reimbursements', async () => {
      movimientoRepository.count
        .mockResolvedValueOnce(0) // as responsable
        .mockResolvedValueOnce(2); // as personaAReembolsar

      const result = await service.canDeletePersona('persona-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('2 reembolso(s) registrado(s)');
      expect(result.movementCount).toBe(2);
    });

    it('should check responsable first and stop if found', async () => {
      movimientoRepository.count.mockResolvedValueOnce(5);

      const result = await service.canDeletePersona('persona-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.movementCount).toBe(5);
      // Should only call count once since first check fails
      expect(movimientoRepository.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('canDeleteInscripcion', () => {
    it('should return canDelete=true when inscripcion has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteInscripcion('inscripcion-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { inscripcionId: 'inscripcion-uuid' },
      });
    });

    it('should return canDelete=false when inscripcion has movements', async () => {
      movimientoRepository.count.mockResolvedValue(2);

      const result = await service.canDeleteInscripcion('inscripcion-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('inscripción tiene 2 movimiento(s)');
      expect(result.movementCount).toBe(2);
    });
  });

  describe('canDeleteCuota', () => {
    it('should return canDelete=true when cuota has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteCuota('cuota-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { cuotaId: 'cuota-uuid' },
      });
    });

    it('should return canDelete=false when cuota has movements', async () => {
      movimientoRepository.count.mockResolvedValue(4);

      const result = await service.canDeleteCuota('cuota-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('cuota tiene 4 movimiento(s)');
      expect(result.movementCount).toBe(4);
    });
  });

  describe('canDeleteCampamento', () => {
    it('should return canDelete=true when campamento has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteCampamento('campamento-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { campamentoId: 'campamento-uuid' },
      });
    });

    it('should return canDelete=false when campamento has movements', async () => {
      movimientoRepository.count.mockResolvedValue(10);

      const result = await service.canDeleteCampamento('campamento-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('campamento tiene 10 movimiento(s)');
      expect(result.movementCount).toBe(10);
    });
  });

  describe('canDeleteEvento', () => {
    it('should return canDelete=true when evento has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteEvento('evento-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { eventoId: 'evento-uuid' },
      });
    });

    it('should return canDelete=false when evento has movements', async () => {
      movimientoRepository.count.mockResolvedValue(7);

      const result = await service.canDeleteEvento('evento-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('evento tiene 7 movimiento(s)');
      expect(result.movementCount).toBe(7);
    });
  });

  describe('canDeleteCaja', () => {
    it('should return canDelete=true when caja has no movements', async () => {
      movimientoRepository.count.mockResolvedValue(0);

      const result = await service.canDeleteCaja('caja-uuid');

      expect(result.canDelete).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(movimientoRepository.count).toHaveBeenCalledWith({
        where: { cajaId: 'caja-uuid' },
      });
    });

    it('should return canDelete=false when caja has movements', async () => {
      movimientoRepository.count.mockResolvedValue(15);

      const result = await service.canDeleteCaja('caja-uuid');

      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('caja tiene 15 movimiento(s)');
      expect(result.movementCount).toBe(15);
    });
  });
});
