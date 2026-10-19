import { dateOnlyTransformer } from './date-only.transformer';

describe('dateOnlyTransformer', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it.each(['UTC', 'America/Argentina/Buenos_Aires', 'Pacific/Auckland'])(
    'guarda el día calendario del DTO (medianoche UTC) sin importar la zona del proceso (%s)',
    (tz) => {
      process.env.TZ = tz;
      expect(dateOnlyTransformer.to(new Date('2026-12-24T00:00:00.000Z'))).toBe(
        '2026-12-24',
      );
    },
  );

  it('deja pasar un string YYYY-MM-DD tal cual', () => {
    expect(dateOnlyTransformer.to('2026-12-24')).toBe('2026-12-24');
  });

  it('respeta undefined y null (columna sin tocar / vacía)', () => {
    expect(dateOnlyTransformer.to(undefined)).toBeUndefined();
    expect(dateOnlyTransformer.to(null)).toBeNull();
  });

  it('al leer devuelve el valor de la base sin cambios', () => {
    expect(dateOnlyTransformer.from('2026-12-24')).toBe('2026-12-24');
  });
});
