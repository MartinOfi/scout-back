import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movimiento } from '../../modules/movimientos/entities/movimiento.entity';

/**
 * Result of a deletion validation check
 */
export interface DeletionCheckResult {
  canDelete: boolean;
  reason?: string;
  movementCount?: number;
}

/**
 * Service to validate if entities can be soft deleted
 * based on their financial relationships (movimientos)
 *
 * Rule: An entity cannot be deleted if it has any associated movimientos,
 * because movimientos are the financial ledger and must be preserved.
 */
@Injectable()
export class DeletionValidatorService {
  constructor(
    @InjectRepository(Movimiento)
    private readonly movimientoRepository: Repository<Movimiento>,
  ) {}

  /**
   * Check if a Persona can be deleted
   * A persona cannot be deleted if:
   * - They are the responsable of any movimiento
   * - They are personaAReembolsar of any movimiento
   */
  async canDeletePersona(personaId: string): Promise<DeletionCheckResult> {
    const asResponsable = await this.movimientoRepository.count({
      where: { responsableId: personaId },
    });

    if (asResponsable > 0) {
      return {
        canDelete: false,
        reason: `No se puede eliminar: la persona es responsable de ${asResponsable} movimiento(s)`,
        movementCount: asResponsable,
      };
    }

    const asReembolsar = await this.movimientoRepository.count({
      where: { personaAReembolsarId: personaId },
    });

    if (asReembolsar > 0) {
      return {
        canDelete: false,
        reason: `No se puede eliminar: la persona tiene ${asReembolsar} reembolso(s) registrado(s)`,
        movementCount: asReembolsar,
      };
    }

    return { canDelete: true };
  }

  /**
   * Check if an Inscripcion can be deleted
   * An inscripcion cannot be deleted if it has any associated movimientos
   */
  async canDeleteInscripcion(
    inscripcionId: string,
  ): Promise<DeletionCheckResult> {
    const count = await this.movimientoRepository.count({
      where: { inscripcionId },
    });

    if (count > 0) {
      return {
        canDelete: false,
        reason: `No se puede eliminar: la inscripción tiene ${count} movimiento(s) asociado(s)`,
        movementCount: count,
      };
    }

    return { canDelete: true };
  }

  /**
   * Check if a Cuota can be deleted
   * A cuota cannot be deleted if it has any associated movimientos
   */
  async canDeleteCuota(cuotaId: string): Promise<DeletionCheckResult> {
    const count = await this.movimientoRepository.count({
      where: { cuotaId },
    });

    if (count > 0) {
      return {
        canDelete: false,
        reason: `No se puede eliminar: la cuota tiene ${count} movimiento(s) asociado(s)`,
        movementCount: count,
      };
    }

    return { canDelete: true };
  }

  /**
   * Check if a Campamento can be deleted
   * A campamento cannot be deleted if it has any associated movimientos
   */
  async canDeleteCampamento(campamentoId: string): Promise<DeletionCheckResult> {
    const count = await this.movimientoRepository.count({
      where: { campamentoId },
    });

    if (count > 0) {
      return {
        canDelete: false,
        reason: `No se puede eliminar: el campamento tiene ${count} movimiento(s) asociado(s)`,
        movementCount: count,
      };
    }

    return { canDelete: true };
  }

  /**
   * Check if an Evento can be deleted
   * An evento cannot be deleted if it has any associated movimientos
   */
  async canDeleteEvento(eventoId: string): Promise<DeletionCheckResult> {
    const count = await this.movimientoRepository.count({
      where: { eventoId },
    });

    if (count > 0) {
      return {
        canDelete: false,
        reason: `No se puede eliminar: el evento tiene ${count} movimiento(s) asociado(s)`,
        movementCount: count,
      };
    }

    return { canDelete: true };
  }

  /**
   * Check if a Caja can be deleted
   * A caja cannot be deleted if it has any associated movimientos
   */
  async canDeleteCaja(cajaId: string): Promise<DeletionCheckResult> {
    const count = await this.movimientoRepository.count({
      where: { cajaId },
    });

    if (count > 0) {
      return {
        canDelete: false,
        reason: `No se puede eliminar: la caja tiene ${count} movimiento(s) asociado(s)`,
        movementCount: count,
      };
    }

    return { canDelete: true };
  }
}
