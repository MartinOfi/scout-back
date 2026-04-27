import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movimiento } from '../../modules/movimientos/entities/movimiento.entity';
import { DELETION_VALIDATOR_MESSAGES } from './deletion-validator.messages';

/**
 * Result of a deletion validation check.
 */
export interface DeletionCheckResult {
  canDelete: boolean;
  reason?: string;
  movementCount?: number;
}

/**
 * Service to validate if entities can be soft deleted based on their
 * financial relationships (movimientos).
 *
 * Rule: An entity cannot be deleted if it has any associated movimientos,
 * because movimientos are the financial ledger and must be preserved.
 *
 * Special case for Eventos
 * ------------------------
 * Eventos have movimientos that originated from venta operations
 * (concepto = EVENTO_VENTA_INGRESO/EVENTO_VENTA_GASTO with a live VentaProducto
 * pointing at them). Those are CASCADE-deletable: erasing the evento removes
 * the ventas and their associated movimientos in the same transaction.
 * Only "external" movimientos (manual ingresos/gastos with no venta backing
 * them) block evento deletion.
 */
@Injectable()
export class DeletionValidatorService {
  constructor(
    @InjectRepository(Movimiento)
    private readonly movimientoRepository: Repository<Movimiento>,
  ) {}

  async canDeletePersona(personaId: string): Promise<DeletionCheckResult> {
    const asResponsable = await this.movimientoRepository.count({
      where: { responsableId: personaId },
    });
    if (asResponsable > 0) {
      return this.blocked(
        DELETION_VALIDATOR_MESSAGES.PERSONA_IS_RESPONSABLE(asResponsable),
        asResponsable,
      );
    }

    const asReembolsar = await this.movimientoRepository.count({
      where: { personaAReembolsarId: personaId },
    });
    if (asReembolsar > 0) {
      return this.blocked(
        DELETION_VALIDATOR_MESSAGES.PERSONA_HAS_REIMBURSEMENTS(asReembolsar),
        asReembolsar,
      );
    }

    return this.allowed();
  }

  async canDeleteInscripcion(
    inscripcionId: string,
  ): Promise<DeletionCheckResult> {
    return this.checkRelationByCount(
      { inscripcionId },
      DELETION_VALIDATOR_MESSAGES.INSCRIPCION_HAS_MOVEMENTS,
    );
  }

  async canDeleteCuota(cuotaId: string): Promise<DeletionCheckResult> {
    return this.checkRelationByCount(
      { cuotaId },
      DELETION_VALIDATOR_MESSAGES.CUOTA_HAS_MOVEMENTS,
    );
  }

  async canDeleteCampamento(
    campamentoId: string,
  ): Promise<DeletionCheckResult> {
    return this.checkRelationByCount(
      { campamentoId },
      DELETION_VALIDATOR_MESSAGES.CAMPAMENTO_HAS_MOVEMENTS,
    );
  }

  async canDeleteCaja(cajaId: string): Promise<DeletionCheckResult> {
    return this.checkRelationByCount(
      { cajaId },
      DELETION_VALIDATOR_MESSAGES.CAJA_HAS_MOVEMENTS,
    );
  }

  async canRemoveParticipanteCampamento(
    campamentoId: string,
    personaId: string,
  ): Promise<DeletionCheckResult> {
    return this.checkRelationByCount(
      { campamentoId, responsableId: personaId },
      DELETION_VALIDATOR_MESSAGES.PARTICIPANTE_CAMPAMENTO_HAS_MOVEMENTS,
    );
  }

  /**
   * Evento deletion is allowed when every movimiento attached to it is
   * cascade-deletable (i.e. has at least one live venta_producto pointing at
   * its id). External movimientos — manual ingresos/gastos with no venta —
   * block deletion to protect the financial ledger from accidental wipes.
   *
   * Implemented with a single query that counts external movimientos using
   * a NOT EXISTS subquery, avoiding round trips and N+1 patterns.
   */
  async canDeleteEvento(eventoId: string): Promise<DeletionCheckResult> {
    const externalCount = await this.movimientoRepository
      .createQueryBuilder('m')
      .where('m.evento_id = :eventoId', { eventoId })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM ventas_productos v
          WHERE v.movimiento_id = m.id
            AND v."deletedAt" IS NULL
        )`,
      )
      .getCount();

    if (externalCount > 0) {
      return this.blocked(
        DELETION_VALIDATOR_MESSAGES.EVENTO_HAS_EXTERNAL_MOVEMENTS(
          externalCount,
        ),
        externalCount,
      );
    }
    return this.allowed();
  }

  // ----- private helpers -----

  private async checkRelationByCount(
    where: Record<string, string>,
    message: (count: number) => string,
  ): Promise<DeletionCheckResult> {
    const count = await this.movimientoRepository.count({ where });
    if (count > 0) {
      return this.blocked(message(count), count);
    }
    return this.allowed();
  }

  private allowed(): DeletionCheckResult {
    return { canDelete: true };
  }

  private blocked(reason: string, movementCount: number): DeletionCheckResult {
    return { canDelete: false, reason, movementCount };
  }
}
