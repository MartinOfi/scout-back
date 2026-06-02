import { BadRequestException } from '@nestjs/common';
import { ReporteEventoService } from './reporte-evento.service';
import { EventosService } from '../eventos.service';
import { ReporteEventoStrategy } from './strategies/reporte-evento.strategy';
import { REPORTE_VARIANTE } from './reporte.constants';
import { TipoEvento, DestinoGanancia } from '../../../common/enums';
import { Evento } from '../entities/evento.entity';

function makeEvento(partial: Partial<Evento>): Evento {
  return { id: 'evt-1', estaCerrado: false, ...partial } as Evento;
}

function makeStrategy(
  variante: ReporteEventoStrategy['variante'],
): ReporteEventoStrategy & { build: jest.Mock } {
  return {
    variante,
    build: jest.fn().mockResolvedValue({ variante }),
  };
}

describe('ReporteEventoService', () => {
  let eventosService: { findOne: jest.Mock };
  let cajaGrupo: ReturnType<typeof makeStrategy>;
  let cuentasPersonales: ReturnType<typeof makeStrategy>;
  let grupo: ReturnType<typeof makeStrategy>;
  let service: ReporteEventoService;

  beforeEach(() => {
    eventosService = { findOne: jest.fn() };
    cajaGrupo = makeStrategy(REPORTE_VARIANTE.VENTA_CAJA_GRUPO);
    cuentasPersonales = makeStrategy(REPORTE_VARIANTE.VENTA_CUENTAS_PERSONALES);
    grupo = makeStrategy(REPORTE_VARIANTE.GRUPO);
    service = new ReporteEventoService(
      eventosService as unknown as EventosService,
      [cajaGrupo, cuentasPersonales, grupo],
    );
  });

  it('delega en la estrategia caja_grupo para venta+caja_grupo', async () => {
    const evento = makeEvento({
      tipo: TipoEvento.VENTA,
      destinoGanancia: DestinoGanancia.CAJA_GRUPO,
    });
    eventosService.findOne.mockResolvedValue(evento);

    const result = await service.getReporte('evt-1');

    expect(cajaGrupo.build).toHaveBeenCalledWith(evento);
    expect(result.variante).toBe(REPORTE_VARIANTE.VENTA_CAJA_GRUPO);
  });

  it('delega en cuentas_personales para venta+cuentas_personales', async () => {
    eventosService.findOne.mockResolvedValue(
      makeEvento({
        tipo: TipoEvento.VENTA,
        destinoGanancia: DestinoGanancia.CUENTAS_PERSONALES,
      }),
    );
    await service.getReporte('evt-1');
    expect(cuentasPersonales.build).toHaveBeenCalled();
    expect(cajaGrupo.build).not.toHaveBeenCalled();
  });

  it('delega en grupo para eventos de grupo', async () => {
    eventosService.findOne.mockResolvedValue(
      makeEvento({ tipo: TipoEvento.GRUPO, destinoGanancia: null }),
    );
    await service.getReporte('evt-1');
    expect(grupo.build).toHaveBeenCalled();
  });

  it('lanza BadRequest si un evento de venta no tiene destinoGanancia', async () => {
    eventosService.findOne.mockResolvedValue(
      makeEvento({ tipo: TipoEvento.VENTA, destinoGanancia: null }),
    );
    await expect(service.getReporte('evt-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
