import { NotFoundException } from '@nestjs/common';
import { EventosController } from './eventos.controller';
import { EventosService } from './eventos.service';
import { VentasEventoService } from './services/ventas-evento.service';
import { ReporteEventoService } from './reporte/reporte-evento.service';
import { Evento } from './entities/evento.entity';

function makeEvento(partial: Partial<Evento>): Evento {
  return { id: 'evt-1', reportePublico: false, ...partial } as Evento;
}

describe('EventosController - reporte público', () => {
  let controller: EventosController;
  let eventosService: { findOne: jest.Mock };
  let reporteEventoService: { getReporte: jest.Mock };

  beforeEach(() => {
    eventosService = { findOne: jest.fn() };
    reporteEventoService = { getReporte: jest.fn() };
    controller = new EventosController(
      eventosService as unknown as EventosService,
      {} as unknown as VentasEventoService,
      reporteEventoService as unknown as ReporteEventoService,
    );
  });

  describe('getReportePublico', () => {
    it('devuelve el reporte cuando reportePublico = true', async () => {
      const reporte = { variante: 'venta_caja_grupo' };
      eventosService.findOne.mockResolvedValue(
        makeEvento({ reportePublico: true }),
      );
      reporteEventoService.getReporte.mockResolvedValue(reporte);

      await expect(controller.getReportePublico('evt-1')).resolves.toBe(
        reporte,
      );
      expect(reporteEventoService.getReporte).toHaveBeenCalledWith('evt-1');
    });

    it('lanza NotFoundException cuando reportePublico = false', async () => {
      eventosService.findOne.mockResolvedValue(
        makeEvento({ reportePublico: false }),
      );

      await expect(controller.getReportePublico('evt-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(reporteEventoService.getReporte).not.toHaveBeenCalled();
    });

    it('propaga el NotFound de findOne cuando el evento no existe', async () => {
      eventosService.findOne.mockRejectedValue(new NotFoundException());

      await expect(controller.getReportePublico('evt-x')).rejects.toThrow(
        NotFoundException,
      );
      expect(reporteEventoService.getReporte).not.toHaveBeenCalled();
    });
  });

  describe('getReporte (autenticado)', () => {
    it('delega en el service sin chequear el flag', async () => {
      const reporte = { variante: 'grupo' };
      reporteEventoService.getReporte.mockResolvedValue(reporte);

      await expect(controller.getReporte('evt-1')).resolves.toBe(reporte);
      expect(eventosService.findOne).not.toHaveBeenCalled();
    });
  });
});
