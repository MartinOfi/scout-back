import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
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
    @Inject(forwardRef(() => CajasService))
    private readonly cajasService: CajasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
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
      registradoPorId,
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
        registradoPorId: registradoPorId ?? null,
      });

      await manager.save(movimientoEgresoPersonal);
    }

    // 2. Crear INGRESO en caja grupo
    const cajaGrupo = await this.cajasService.findCajaGrupo();

    // Determinar método de pago para el ingreso
    const esPagoMixto = montoFisico > 0 && montoConSaldoPersonal > 0;
    const medioPagoIngreso = esPagoMixto
      ? MedioPago.MIXTO
      : montoFisico > 0
        ? medioPago
        : MedioPago.SALDO_PERSONAL;

    // Construir descripción con desglose si es pago mixto
    let descripcionFinal = descripcion ?? '';
    if (esPagoMixto) {
      const metodoFisicoLabel =
        medioPago === MedioPago.TRANSFERENCIA ? 'transferencia' : 'efectivo';
      const desglose = `(${metodoFisicoLabel}: $${montoFisico}, saldo personal: $${montoConSaldoPersonal})`;
      descripcionFinal = descripcionFinal
        ? `${descripcionFinal} ${desglose}`
        : desglose;
    }

    const movimientoIngreso = manager.create(Movimiento, {
      cajaId: cajaGrupo.id,
      tipo: TipoMovimiento.INGRESO,
      monto: montoTotal,
      concepto,
      medioPago: medioPagoIngreso,
      responsableId: personaId,
      estadoPago: EstadoPago.PAGADO,
      inscripcionId,
      cuotaId,
      campamentoId,
      descripcion: descripcionFinal || undefined,
      fecha: new Date(),
      registradoPorId: registradoPorId ?? null,
      // Link to egreso if exists
      movimientoRelacionadoId: movimientoEgresoPersonal?.id ?? null,
    });

    await manager.save(movimientoIngreso);

    // 3. Update egreso with ingreso ID (bidirectional link)
    if (movimientoEgresoPersonal) {
      movimientoEgresoPersonal.movimientoRelacionadoId = movimientoIngreso.id;
      await manager.save(movimientoEgresoPersonal);
    }

    // 4. Retornar resultado
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
