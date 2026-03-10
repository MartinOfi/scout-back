import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { EjecutarPagoParams } from './interfaces/ejecutar-pago.interface';
import { ResultadoPagoDto } from './dtos/resultado-pago.dto';
import {
  MedioPago,
  ConceptoMovimiento,
  TipoMovimiento,
  EstadoPago,
} from '../../common/enums';

@Injectable()
export class PagosService {
  constructor(
    private readonly cajasService: CajasService,
    private readonly movimientosService: MovimientosService,
    private readonly dataSource: DataSource,
  ) {}

  async ejecutarPagoConManager(
    manager: EntityManager,
    params: EjecutarPagoParams,
  ): Promise<ResultadoPagoDto> {
    const {
      personaId,
      montoTotal,
      montoConSaldoPersonal = 0,
      medioPago = MedioPago.EFECTIVO,
      concepto,
      inscripcionId,
      cuotaId,
      campamentoId,
      descripcion,
    } = params;

    const montoFisico = montoTotal - montoConSaldoPersonal;
    let movimientoEgresoPersonal: Movimiento | undefined;

    // 1. Crear EGRESO de caja personal (si aplica)
    if (montoConSaldoPersonal > 0) {
      const cajaPersonal = await this.cajasService.findCajaPersonal(personaId);
      if (!cajaPersonal) {
        throw new BadRequestException('La persona no tiene caja personal');
      }

      const saldoDisponible = await this.movimientosService.calcularSaldo(
        cajaPersonal.id,
      );
      if (saldoDisponible < montoConSaldoPersonal) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponible: $${saldoDisponible}, Requerido: $${montoConSaldoPersonal}`,
        );
      }

      movimientoEgresoPersonal = manager.create(Movimiento, {
        cajaId: cajaPersonal.id,
        tipo: TipoMovimiento.EGRESO,
        monto: montoConSaldoPersonal,
        concepto: ConceptoMovimiento.USO_SALDO_PERSONAL,
        medioPago: MedioPago.SALDO_PERSONAL,
        responsableId: personaId,
        estadoPago: EstadoPago.PAGADO,
        inscripcionId,
        cuotaId,
        campamentoId,
        descripcion: descripcion ?? 'Uso de saldo personal para pago',
        fecha: new Date(),
      });

      await manager.save(movimientoEgresoPersonal);
    }

    // 2. Crear INGRESO en caja grupo
    const cajaGrupo = await this.cajasService.findCajaGrupo();

    const movimientoIngreso = manager.create(Movimiento, {
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.INGRESO,
      monto: montoTotal,
      concepto,
      medioPago: montoFisico > 0 ? medioPago : MedioPago.SALDO_PERSONAL,
      responsableId: personaId,
      estadoPago: EstadoPago.PAGADO,
      inscripcionId,
      cuotaId,
      campamentoId,
      descripcion,
      fecha: new Date(),
    });

    await manager.save(movimientoIngreso);

    // 3. Retornar resultado
    return {
      movimientoIngreso: {
        id: movimientoIngreso.id,
        monto: Number(movimientoIngreso.monto),
        concepto: movimientoIngreso.concepto,
        medioPago: movimientoIngreso.medioPago,
      },
      movimientoEgresoPersonal: movimientoEgresoPersonal
        ? {
            id: movimientoEgresoPersonal.id,
            monto: Number(movimientoEgresoPersonal.monto),
          }
        : undefined,
      desglose: {
        montoSaldoPersonal: montoConSaldoPersonal,
        montoFisico,
        total: montoTotal,
      },
    };
  }
}
