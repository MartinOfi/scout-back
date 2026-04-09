import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Caja } from './entities/caja.entity';
import { CreateCajaDto, ConsolidadoSaldosDto, CajaResponseDto } from './dtos';
import { CajaType } from '../../common/enums';
import { DeletionValidatorService } from '../../common/services/deletion-validator.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { InscripcionesService } from '../inscripciones/inscripciones.service';
import { CuotasService } from '../cuotas/cuotas.service';
import { CampamentosService } from '../campamentos/campamentos.service';

@Injectable()
export class CajasService {
  constructor(
    @InjectRepository(Caja)
    private readonly cajaRepository: Repository<Caja>,
    private readonly dataSource: DataSource,
    private readonly deletionValidator: DeletionValidatorService,
    @Inject(forwardRef(() => MovimientosService))
    private readonly movimientosService: MovimientosService,
    @Inject(forwardRef(() => InscripcionesService))
    private readonly inscripcionesService: InscripcionesService,
    @Inject(forwardRef(() => CuotasService))
    private readonly cuotasService: CuotasService,
    @Inject(forwardRef(() => CampamentosService))
    private readonly campamentosService: CampamentosService,
  ) {}

  async findAll(): Promise<CajaResponseDto[]> {
    const cajas = await this.cajaRepository.find({
      relations: ['propietario'],
      order: { tipo: 'ASC', nombre: 'ASC' },
    });

    return this.mapCajasWithSaldo(cajas);
  }

  async findByTipo(tipo: CajaType): Promise<CajaResponseDto[]> {
    const cajas = await this.cajaRepository.find({
      where: { tipo },
      relations: ['propietario'],
    });

    return this.mapCajasWithSaldo(cajas);
  }

  async findOne(id: string): Promise<CajaResponseDto> {
    const caja = await this.findOneEntity(id);
    const saldo = await this.movimientosService.calcularSaldo(caja.id);
    return this.mapCajaToResponse(caja, saldo);
  }

  /**
   * Internal method to find a Caja entity by ID
   * Use this for internal operations that need the entity (not the DTO)
   */
  private async findOneEntity(id: string): Promise<Caja> {
    const caja = await this.cajaRepository.findOne({
      where: { id },
      relations: ['propietario'],
    });

    if (!caja) {
      throw new NotFoundException(`Caja con ID ${id} no encontrada`);
    }

    return caja;
  }

  /**
   * Maps an array of Caja entities to CajaResponseDto with calculated saldo
   */
  private async mapCajasWithSaldo(cajas: Caja[]): Promise<CajaResponseDto[]> {
    if (cajas.length === 0) return [];
    const cajaIds = cajas.map((caja) => caja.id);
    const saldoMap = await this.movimientosService.calcularSaldosBatch(cajaIds);
    return cajas.map((caja) =>
      this.mapCajaToResponse(caja, saldoMap.get(caja.id) ?? 0),
    );
  }

  /**
   * Maps a single Caja entity to CajaResponseDto
   */
  private mapCajaToResponse(caja: Caja, saldo: number): CajaResponseDto {
    return {
      id: caja.id,
      tipo: caja.tipo,
      nombre: caja.nombre,
      propietarioId: caja.propietarioId,
      propietario: caja.propietario
        ? {
            id: caja.propietario.id,
            nombre: caja.propietario.nombre,
          }
        : null,
      saldoActual: saldo,
      createdAt: caja.createdAt,
      updatedAt: caja.updatedAt,
    };
  }

  async findCajaGrupo(): Promise<CajaResponseDto> {
    const caja = await this.cajaRepository.findOne({
      where: { tipo: CajaType.GRUPO },
    });

    if (!caja) {
      throw new NotFoundException('Caja del grupo no encontrada');
    }

    const saldo = await this.movimientosService.calcularSaldo(caja.id);
    return this.mapCajaToResponse(caja, saldo);
  }

  async findCajaPersonal(propietarioId: string): Promise<Caja | null> {
    return this.cajaRepository.findOne({
      where: { tipo: CajaType.PERSONAL, propietarioId },
      relations: ['propietario'],
    });
  }

  /**
   * Obtiene el saldo de la cuenta personal de una persona
   * Retorna 0 si la persona no tiene cuenta personal
   */
  async getSaldoCuentaPersonal(personaId: string): Promise<number> {
    const caja = await this.findCajaPersonal(personaId);
    if (!caja) {
      return 0;
    }
    return this.movimientosService.calcularSaldo(caja.id);
  }

  async create(dto: CreateCajaDto): Promise<Caja> {
    // Validaciones de negocio
    if (dto.tipo === CajaType.GRUPO) {
      const existente = await this.cajaRepository.findOne({
        where: { tipo: CajaType.GRUPO },
      });
      if (existente) {
        throw new BadRequestException('Ya existe una caja de grupo');
      }
    }

    if (dto.tipo === CajaType.PERSONAL && !dto.propietarioId) {
      throw new BadRequestException(
        'Las cajas personales requieren un propietario',
      );
    }

    if (dto.tipo === CajaType.PERSONAL && dto.propietarioId) {
      const existente = await this.findCajaPersonal(dto.propietarioId);
      if (existente) {
        throw new BadRequestException(
          'Esta persona ya tiene una caja personal',
        );
      }
    }

    const caja = this.cajaRepository.create(dto);
    return this.cajaRepository.save(caja);
  }

  async remove(id: string): Promise<void> {
    const caja = await this.findOneEntity(id);

    if (caja.tipo === CajaType.GRUPO) {
      throw new BadRequestException('No se puede eliminar la caja del grupo');
    }

    // Validar que no tenga movimientos asociados
    const check = await this.deletionValidator.canDeleteCaja(id);
    if (!check.canDelete) {
      throw new BadRequestException(check.reason);
    }

    await this.cajaRepository.softRemove(caja);
  }

  async getOrCreateCajaPersonal(
    propietarioId: string,
    nombrePropietario?: string,
  ): Promise<Caja> {
    let caja = await this.findCajaPersonal(propietarioId);

    if (!caja) {
      caja = this.cajaRepository.create({
        tipo: CajaType.PERSONAL,
        propietarioId,
        nombre: nombrePropietario
          ? `Cuenta Personal - ${nombrePropietario}`
          : undefined,
      });
      caja = await this.cajaRepository.save(caja);
    }

    return caja;
  }

  /**
   * Obtiene el consolidado de saldos de todas las cajas y deudas
   */
  async getConsolidadoSaldos(): Promise<ConsolidadoSaldosDto> {
    // Single CTE query fetches ALL consolidado data in 1 round-trip (~330ms)
    // instead of 6+ sequential queries (~1500ms+ on high-latency connections)
    const [raw] = await this.dataSource.query(`
      WITH saldos AS (
        SELECT caja_id,
          SUM(CASE
            WHEN tipo = 'ingreso' THEN monto
            WHEN tipo = 'egreso' AND "estadoPago" != 'pendiente_reembolso' THEN -monto
            ELSE 0
          END) AS saldo
        FROM movimientos WHERE "deletedAt" IS NULL
        GROUP BY caja_id
      ),
      reembolsos AS (
        SELECT COALESCE(SUM(monto), 0) AS total,
          COUNT(DISTINCT persona_a_reembolsar_id) AS cantidad
        FROM movimientos
        WHERE "estadoPago" = 'pendiente_reembolso'
          AND "deletedAt" IS NULL
          AND persona_a_reembolsar_id IS NOT NULL
      ),
      deuda_inscr AS (
        SELECT
          COALESCE(SUM(GREATEST(0, i."montoTotal" - i."montoBonificado" - COALESCE(p.total_pagado, 0))), 0) AS total,
          COUNT(CASE WHEN i."montoTotal" - i."montoBonificado" - COALESCE(p.total_pagado, 0) > 0 THEN 1 END) AS cantidad
        FROM inscripciones i
        LEFT JOIN (
          SELECT inscripcion_id, SUM(monto) AS total_pagado
          FROM movimientos
          WHERE "deletedAt" IS NULL AND tipo = 'ingreso' AND inscripcion_id IS NOT NULL
          GROUP BY inscripcion_id
        ) p ON p.inscripcion_id = i.id
        WHERE i."deletedAt" IS NULL
      ),
      deuda_cuotas AS (
        SELECT COALESCE(SUM("montoTotal" - "montoPagado"), 0) AS total,
          COUNT(*) AS cantidad
        FROM cuotas
        WHERE "deletedAt" IS NULL AND "montoTotal" > "montoPagado"
      ),
      deuda_camp AS (
        SELECT
          COALESCE(SUM(GREATEST(0, c."costoPorPersona" - COALESCE(pagos.total_pagado, 0))), 0) AS total,
          COUNT(CASE WHEN c."costoPorPersona" - COALESCE(pagos.total_pagado, 0) > 0 THEN 1 END) AS cantidad
        FROM campamentos c
        INNER JOIN campamento_participantes cp ON cp.campamento_id = c.id
        LEFT JOIN (
          SELECT responsable_id, campamento_id, SUM(monto) AS total_pagado
          FROM movimientos
          WHERE "deletedAt" IS NULL AND tipo = 'ingreso' AND concepto = 'campamento_pago'
          GROUP BY responsable_id, campamento_id
        ) pagos ON pagos.responsable_id = cp.persona_id AND pagos.campamento_id = c.id
        WHERE c."deletedAt" IS NULL
      )
      SELECT
        (SELECT json_agg(row_to_json(t)) FROM (
          SELECT c.id, c.tipo, c.nombre, COALESCE(s.saldo, 0) AS saldo
          FROM cajas c LEFT JOIN saldos s ON s.caja_id = c.id
          WHERE c."deletedAt" IS NULL ORDER BY c.tipo, c.nombre
        ) t) AS cajas,
        (SELECT row_to_json(r) FROM reembolsos r) AS reembolsos,
        (SELECT row_to_json(d) FROM deuda_inscr d) AS deuda_inscripciones,
        (SELECT row_to_json(d) FROM deuda_cuotas d) AS deuda_cuotas,
        (SELECT row_to_json(d) FROM deuda_camp d) AS deuda_campamentos
    `);

    // Parse the aggregated result
    const cajas: {
      id: string;
      tipo: CajaType;
      nombre: string | null;
      saldo: number;
    }[] = raw.cajas ?? [];
    const reembolsos = raw.reembolsos ?? { total: 0, cantidad: 0 };
    const deudaInscripciones = raw.deuda_inscripciones ?? {
      total: 0,
      cantidad: 0,
    };
    const deudaCuotas = raw.deuda_cuotas ?? { total: 0, cantidad: 0 };
    const deudaCampamentos = raw.deuda_campamentos ?? { total: 0, cantidad: 0 };

    // Classify cajas by type
    const cajaGrupo = cajas.find((c) => c.tipo === CajaType.GRUPO) ?? null;
    const ramaTipos = new Set([
      CajaType.RAMA_MANADA,
      CajaType.RAMA_UNIDAD,
      CajaType.RAMA_CAMINANTES,
      CajaType.RAMA_ROVERS,
    ]);
    const cajasRama = cajas.filter((c) => ramaTipos.has(c.tipo));
    const cajasPersonales = cajas.filter((c) => c.tipo === CajaType.PERSONAL);

    const saldoGrupo = Number(cajaGrupo?.saldo ?? 0);
    const saldosRama = cajasRama.map((caja) => ({
      tipo: caja.tipo,
      id: caja.id,
      nombre: caja.nombre || this.getNombreRama(caja.tipo),
      saldo: Number(caja.saldo),
    }));
    const saldosPersonales = cajasPersonales.map((c) => Number(c.saldo));

    const totalRamas = saldosRama.reduce((sum, r) => sum + r.saldo, 0);
    const totalPersonales = saldosPersonales.reduce((sum, s) => sum + s, 0);
    const totalReembolsos = Number(reembolsos.total);
    const totalDeudas =
      Number(deudaInscripciones.total) +
      Number(deudaCuotas.total) +
      Number(deudaCampamentos.total);

    const totalGeneral = saldoGrupo + totalRamas + totalPersonales;
    const totalDisponible = totalGeneral - totalReembolsos;

    return {
      fecha: new Date().toISOString(),
      resumen: {
        totalGeneral,
        totalDisponible,
        totalPorCobrar: totalDeudas,
      },
      cajaGrupo: {
        id: cajaGrupo?.id ?? '',
        saldo: saldoGrupo,
      },
      fondosRama: {
        total: totalRamas,
        detalle: saldosRama,
      },
      cuentasPersonales: {
        total: totalPersonales,
        cantidad: cajasPersonales.length,
      },
      reembolsosPendientes: {
        total: totalReembolsos,
        cantidad: Number(reembolsos.cantidad),
      },
      deudasTotales: {
        total: totalDeudas,
        inscripciones: {
          total: Number(deudaInscripciones.total),
          cantidad: Number(deudaInscripciones.cantidad),
        },
        cuotas: {
          total: Number(deudaCuotas.total),
          cantidad: Number(deudaCuotas.cantidad),
        },
        campamentos: {
          total: Number(deudaCampamentos.total),
          cantidad: Number(deudaCampamentos.cantidad),
        },
      },
    };
  }

  private getNombreRama(tipo: CajaType): string {
    const nombres: Record<string, string> = {
      [CajaType.RAMA_MANADA]: 'Fondo Manada',
      [CajaType.RAMA_UNIDAD]: 'Fondo Unidad',
      [CajaType.RAMA_CAMINANTES]: 'Fondo Caminantes',
      [CajaType.RAMA_ROVERS]: 'Fondo Rovers',
    };
    return nombres[tipo] ?? tipo;
  }
}
