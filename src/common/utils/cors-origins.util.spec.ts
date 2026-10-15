import {
  DEFAULT_ALLOWED_ORIGINS,
  resolveAllowedOrigins,
} from './cors-origins.util';

describe('resolveAllowedOrigins', () => {
  it('sin variable de entorno devuelve los orígenes por defecto', () => {
    expect(resolveAllowedOrigins(undefined)).toEqual([
      ...DEFAULT_ALLOWED_ORIGINS,
    ]);
  });

  it('por defecto solo incluye el front local', () => {
    expect(DEFAULT_ALLOWED_ORIGINS).toEqual(['http://localhost:4201']);
  });

  it('suma los orígenes de FRONTEND_URL separados por coma', () => {
    const origins = resolveAllowedOrigins(
      'https://a.vercel.app,https://b.vercel.app',
    );
    expect(origins).toEqual([
      ...DEFAULT_ALLOWED_ORIGINS,
      'https://a.vercel.app',
      'https://b.vercel.app',
    ]);
  });

  it('normaliza espacios y barras finales, e ignora vacíos', () => {
    const origins = resolveAllowedOrigins(' https://a.vercel.app/ , ,');
    expect(origins).toEqual([
      ...DEFAULT_ALLOWED_ORIGINS,
      'https://a.vercel.app',
    ]);
  });

  it('no duplica orígenes ya incluidos por defecto', () => {
    const origins = resolveAllowedOrigins('http://localhost:4201/');
    expect(origins).toEqual([...DEFAULT_ALLOWED_ORIGINS]);
  });
});
