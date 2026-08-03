import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CajasService } from '../cajas/cajas.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { CreateMovimientoDto } from '../movimientos/dtos/create-movimiento.dto';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { OtorgarBonificacionParams } from './interfaces/otorgar-bonificacion.interface';
import { ResultadoBonificacionDto } from './dtos/resultado-bonificacion.dto';
import {
  ConceptoMovimiento,
  TipoMovimiento,
  MedioPago,
  EstadoPago,
  CajaType,
} from '../../common/enums';

/**
 * Otorga y revierte bonificaciones financiadas por el fondo solidario.
 *
 * Una bonificación es una transferencia real: EGRESO del fondo solidario +
 * INGRESO a la caja grupo, linkeados por movimientoRelacionadoId.
 *
 * CRÍTICO: el saldo se calcula con una query cruda A TRAVÉS del manager de
 * la transacción — nunca con movimientosService.calcularSaldo(), que usa el
 * pool de conexiones normal y no ve los cambios hechos dentro de la misma
 * transacción. Sin esto, ajustar una bonificación existente (revertir +
 * crear de nuevo) lee un saldo que todavía no refleja la reversión, y
 * rechaza ajustes que en realidad alcanzan de sobra.
 */
@Injectable()
export class BonificacionesService {
  constructor(
    @Inject(forwardRef(() => CajasService))
    private readonly cajasService: CajasService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
  ) {}

  async otorgarConManager(
    manager: EntityManager,
    params: OtorgarBonificacionParams,
  ): Promise<ResultadoBonificacionDto> {
    const { personaId, monto, campamentoId, inscripcionId, descripcion, registradoPorId } =
      params;

    if (monto <= 0) {
      throw new BadRequestException('El monto de la bonificación debe ser mayor a cero');
    }

    const cajaFondo = await this.cajasService.findCajaFondoSolidario();
    if (!cajaFondo) {
      throw new BadRequestException('No existe la caja de fondo solidario');
    }

    const cajaGrupo = await this.cajasService.findCajaGrupo();

    // Lock: serializa bonificaciones concurrentes sobre el mismo fondo.
    await manager.query(
      `SELECT id FROM cajas WHERE tipo = $1 AND "deletedAt" IS NULL FOR UPDATE`,
      [CajaType.FONDO_SOLIDARIO],
    );

    // Saldo leído CON el manager — ve cualquier reversión hecha antes en
    // esta misma transacción (ver docstring de la clase).
    const [{ saldo }]: [{ saldo: string }] = await manager.query(
      `SELECT COALESCE(SUM(CASE
         WHEN tipo = 'ingreso' THEN monto
         WHEN tipo = 'egreso' AND "estadoPago" != 'pendiente_reembolso' THEN -monto
         ELSE 0 END), 0) AS saldo
       FROM movimientos
       WHERE caja_id = $1 AND "deletedAt" IS NULL`,
      [cajaFondo.id],
    );
    const saldoDisponible = Number(saldo);

    if (saldoDisponible < monto) {
      throw new BadRequestException(
        `El fondo solidario tiene $${saldoDisponible} disponibles, se requieren $${monto}`,
      );
    }

    const fecha = new Date();
    const textoDescripcion = descripcion ?? 'Bonificación del fondo solidario';

    const egreso = await this.movimientosService.createWithManager(
      manager,
      {
        cajaId: cajaFondo.id,
        tipo: TipoMovimiento.EGRESO,
        monto,
        concepto: ConceptoMovimiento.BONIFICACION_OTORGADA,
        descripcion: textoDescripcion,
        responsableId: personaId,
        medioPago: MedioPago.EFECTIVO,
        estadoPago: EstadoPago.PAGADO,
        requiereComprobante: false,
        fecha,
        ...(campamentoId ? { campamentoId } : {}),
        ...(inscripcionId ? { inscripcionId } : {}),
      } as CreateMovimientoDto,
      registradoPorId,
    );

    const ingreso = await this.movimientosService.createWithManager(
      manager,
      {
        cajaId: cajaGrupo.id,
        tipo: TipoMovimiento.INGRESO,
        monto,
        concepto: ConceptoMovimiento.BONIFICACION_RECIBIDA,
        descripcion: textoDescripcion,
        responsableId: personaId,
        medioPago: MedioPago.EFECTIVO,
        estadoPago: EstadoPago.PAGADO,
        requiereComprobante: false,
        fecha,
        ...(campamentoId ? { campamentoId } : {}),
        ...(inscripcionId ? { inscripcionId } : {}),
      } as CreateMovimientoDto,
      registradoPorId,
    );

    await manager.update(Movimiento, egreso.id, { movimientoRelacionadoId: ingreso.id });
    await manager.update(Movimiento, ingreso.id, { movimientoRelacionadoId: egreso.id });

    return {
      movimientoEgresoId: egreso.id,
      movimientoIngresoId: ingreso.id,
      monto,
      saldoFondoRestante: saldoDisponible - monto,
    };
  }
}
