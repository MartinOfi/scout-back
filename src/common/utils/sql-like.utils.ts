/**
 * Escapes characters that have special meaning in Postgres `LIKE`/`ILIKE`
 * patterns (`%`, `_`, `\`). Without this a caller could pass `?vendedor=%`
 * and effectively match every row, bypassing the intent of the filter.
 *
 * Shared between modules that expose ILIKE-based name filters — keep this
 * the single source of truth so a divergence (e.g. one module forgets to
 * escape `_`) cannot happen.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (char) => `\\${char}`);
}
