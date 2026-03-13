import {
  PersonaType,
  EstadoPersona,
  Rama,
  CargoEducador,
} from '../../../common/enums';

/**
 * Authenticated user information extracted from JWT
 * Used in request.user after JWT validation
 */
export interface AuthenticatedUser {
  id: string;
  nombre: string;
  email: string;
  tipo: PersonaType;
  estado: EstadoPersona;
  rama?: Rama | null;
  cargo?: CargoEducador;
}
