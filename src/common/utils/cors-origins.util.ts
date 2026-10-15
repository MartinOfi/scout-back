/**
 * Orígenes que siempre acepta el CORS, además de los que se agreguen
 * por `FRONTEND_URL` (lista separada por comas).
 */
export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:4201'] as const;

const ORIGIN_SEPARATOR = ',';
const TRAILING_SLASHES = /\/+$/;

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(TRAILING_SLASHES, '');
}

export function resolveAllowedOrigins(rawEnv: string | undefined): string[] {
  const envOrigins = (rawEnv ?? '')
    .split(ORIGIN_SEPARATOR)
    .map(normalizeOrigin)
    .filter((origin) => origin.length > 0);

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins])];
}
