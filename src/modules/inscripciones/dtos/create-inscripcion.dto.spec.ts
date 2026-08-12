import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInscripcionDto } from './create-inscripcion.dto';
import { TipoInscripcion } from '../../../common/enums';

/**
 * Valida las reglas de `montoTotal`, que decide si una inscripción se puede
 * registrar sin costo. El caso 0 es el de "persona nueva": la inscripción se
 * crea en $0 en vez de bonificarse al 100% contra el fondo solidario.
 */
describe('CreateInscripcionDto', () => {
  const baseDto = {
    personaId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    tipo: TipoInscripcion.SCOUT_ARGENTINA,
    ano: 2026,
  };

  const validarMontoTotal = async (montoTotal: unknown): Promise<string[]> => {
    const dto = plainToInstance(CreateInscripcionDto, {
      ...baseDto,
      montoTotal,
    });
    const errores = await validate(dto);
    const errorMonto = errores.find((error) => error.property === 'montoTotal');
    return Object.keys(errorMonto?.constraints ?? {});
  };

  it('acepta montoTotal 0 (inscripción sin costo / persona nueva)', async () => {
    await expect(validarMontoTotal(0)).resolves.toEqual([]);
  });

  it('acepta un montoTotal positivo', async () => {
    await expect(validarMontoTotal(15000)).resolves.toEqual([]);
  });

  it('acepta hasta 2 decimales', async () => {
    await expect(validarMontoTotal(15000.55)).resolves.toEqual([]);
  });

  it('rechaza montoTotal negativo', async () => {
    await expect(validarMontoTotal(-1)).resolves.toContain('min');
  });

  it('rechaza más de 2 decimales', async () => {
    await expect(validarMontoTotal(100.123)).resolves.toContain('isNumber');
  });

  it('rechaza montoTotal ausente', async () => {
    await expect(validarMontoTotal(undefined)).resolves.toContain('isNumber');
  });

  it('no exige medios de pago para una inscripción en 0', async () => {
    const dto = plainToInstance(CreateInscripcionDto, {
      ...baseDto,
      montoTotal: 0,
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
