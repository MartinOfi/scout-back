import { PersonaType, Rama } from '../enums';

/**
 * Papeles de inscripción Scout Argentina que los mayores de edad NO deben
 * entregar y, por lo tanto, no generan deuda de documentación para ellos:
 * - Autorización de imagen
 * - Autorización de ingreso
 * - Permiso de salidas cercanas
 */
export const PAPELES_EXENTOS_ADULTOS = [
  'autorizacionDeImagen',
  'autorizacionIngreso',
  'salidasCercanas',
] as const;

/**
 * Indica si una persona es mayor de edad a los fines de la documentación.
 * Los mayores de edad quedan exentos de:
 * - la documentación personal (DNI, partida, DNI de padres, carnet obra social)
 * - los papeles de imagen, ingreso y salidas cercanas (ver PAPELES_EXENTOS_ADULTOS)
 *
 * Aplica a Educadores y a Protagonistas de la rama Rovers.
 */
export function esMayorDeEdad(
  tipo: PersonaType,
  rama: Rama | null | undefined,
): boolean {
  return tipo === PersonaType.EDUCADOR || rama === Rama.ROVERS;
}
