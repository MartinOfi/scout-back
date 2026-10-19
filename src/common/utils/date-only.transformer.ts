import { ValueTransformer } from 'typeorm';

/** Largo de `YYYY-MM-DD`. */
const DATE_ONLY_LENGTH = 10;

/**
 * Columnas `date` (sin hora): fechas de campamentos y eventos.
 *
 * Los DTOs convierten `"2026-12-24"` en medianoche UTC. Si TypeORM recibe ese
 * `Date`, lo pasa a `YYYY-MM-DD` con la zona horaria del proceso: en una
 * máquina en UTC-3 se guardaría el 23. Acá se toma el día calendario en UTC,
 * así el valor guardado no depende de dónde corre el servidor. Al leer, el
 * driver ya devuelve el string `YYYY-MM-DD`.
 */
export const dateOnlyTransformer: ValueTransformer = {
  to: (value?: Date | string | null): string | null | undefined =>
    value instanceof Date
      ? value.toISOString().slice(0, DATE_ONLY_LENGTH)
      : value,
  from: (value?: string | null): string | null | undefined => value,
};
