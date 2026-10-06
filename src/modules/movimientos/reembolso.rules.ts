import { BadRequestException } from '@nestjs/common';
import { EstadoPago } from '../../common/enums';
import { Persona } from '../personas/entities/persona.entity';
import { Movimiento } from './entities/movimiento.entity';

export const REEMBOLSO_ERROR_MESSAGES = {
  PERSONA_A_REEMBOLSAR_REQUERIDA:
    'Un movimiento pendiente de reembolso debe indicar a quién reembolsar',
} as const;

/**
 * A pending refund is a debt owed to someone, so it must name the creditor.
 * Without it the movimiento silently drops out of the dashboard and the
 * reembolsos report (both group by creditor).
 */
export function assertPersonaAReembolsar(
  mov: Pick<Movimiento, 'estadoPago'> & {
    personaAReembolsarId?: string | null;
  },
): void {
  if (
    mov.estadoPago === EstadoPago.PENDIENTE_REEMBOLSO &&
    !mov.personaAReembolsarId
  ) {
    throw new BadRequestException(
      REEMBOLSO_ERROR_MESSAGES.PERSONA_A_REEMBOLSAR_REQUERIDA,
    );
  }
}

/**
 * Who the group owes the refund to. Legacy rows created before the creditor
 * was mandatory fall back to the responsable (whoever paid out of pocket).
 * Keep in sync with the COALESCE in CajasService.getConsolidadoSaldos.
 */
export function resolverAcreedorReembolso(mov: Movimiento): Persona | null {
  return mov.personaAReembolsar ?? mov.responsable ?? null;
}
