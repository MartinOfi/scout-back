import { esMayorDeEdad } from './papeles.util';
import { PersonaType, Rama } from '../enums';

describe('esMayorDeEdad', () => {
  it('exime a los educadores (sin importar la rama)', () => {
    expect(esMayorDeEdad(PersonaType.EDUCADOR, null)).toBe(true);
    expect(esMayorDeEdad(PersonaType.EDUCADOR, Rama.UNIDAD)).toBe(true);
  });

  it('exime a los protagonistas de la rama Rovers', () => {
    expect(esMayorDeEdad(PersonaType.PROTAGONISTA, Rama.ROVERS)).toBe(true);
  });

  it('no exime a protagonistas de ramas menores', () => {
    expect(esMayorDeEdad(PersonaType.PROTAGONISTA, Rama.MANADA)).toBe(false);
    expect(esMayorDeEdad(PersonaType.PROTAGONISTA, Rama.UNIDAD)).toBe(false);
    expect(esMayorDeEdad(PersonaType.PROTAGONISTA, Rama.CAMINANTES)).toBe(
      false,
    );
  });
});
