import { BadRequestException } from '@nestjs/common';
import { EstadoPago } from '../../common/enums';
import { Persona } from '../personas/entities/persona.entity';
import { Movimiento } from './entities/movimiento.entity';
import {
  assertPersonaAReembolsar,
  resolverAcreedorReembolso,
  REEMBOLSO_ERROR_MESSAGES,
} from './reembolso.rules';

describe('reembolso.rules', () => {
  describe('assertPersonaAReembolsar', () => {
    it('rechaza pendiente_reembolso sin persona a reembolsar', () => {
      expect(() =>
        assertPersonaAReembolsar({
          estadoPago: EstadoPago.PENDIENTE_REEMBOLSO,
          personaAReembolsarId: null,
        }),
      ).toThrow(
        new BadRequestException(
          REEMBOLSO_ERROR_MESSAGES.PERSONA_A_REEMBOLSAR_REQUERIDA,
        ),
      );
    });

    it('acepta pendiente_reembolso con persona a reembolsar', () => {
      expect(() =>
        assertPersonaAReembolsar({
          estadoPago: EstadoPago.PENDIENTE_REEMBOLSO,
          personaAReembolsarId: 'persona-uuid',
        }),
      ).not.toThrow();
    });

    it('no exige persona en otros estados', () => {
      expect(() =>
        assertPersonaAReembolsar({
          estadoPago: EstadoPago.PAGADO,
          personaAReembolsarId: undefined,
        }),
      ).not.toThrow();
    });
  });

  describe('resolverAcreedorReembolso', () => {
    const responsable = {
      id: 'resp-uuid',
      nombre: 'Pilón, Bárbara',
    } as Persona;
    const acreedor = { id: 'acr-uuid', nombre: 'Garcia, Héctor' } as Persona;

    it('usa la persona a reembolsar cuando está cargada', () => {
      const mov = {
        personaAReembolsarId: acreedor.id,
        personaAReembolsar: acreedor,
        responsableId: responsable.id,
        responsable,
      } as Movimiento;

      expect(resolverAcreedorReembolso(mov)).toBe(acreedor);
    });

    it('cae al responsable en registros viejos sin persona a reembolsar', () => {
      const mov = {
        personaAReembolsarId: null,
        personaAReembolsar: null,
        responsableId: responsable.id,
        responsable,
      } as Movimiento;

      expect(resolverAcreedorReembolso(mov)).toBe(responsable);
    });
  });
});
