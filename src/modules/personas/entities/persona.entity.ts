import { Entity, Column, TableInheritance, ChildEntity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  PersonaType,
  EstadoPersona,
  Rama,
  CargoEducador,
} from '../../../common/enums';

/**
 * Persona base entity using Single Table Inheritance
 * Discriminator column: 'tipo'
 * Children: Protagonista, Educador, PersonaExterna
 */
@Entity('personas')
@TableInheritance({ column: { type: 'varchar', name: 'tipo' } })
export abstract class Persona extends BaseEntity {
  @Column({ length: 100 })
  nombre!: string;

  @Column({ type: 'enum', enum: EstadoPersona, default: EstadoPersona.ACTIVO })
  estado!: EstadoPersona;

  @Column({ type: 'varchar', length: 20 })
  tipo!: PersonaType;
}

/**
 * Protagonista: Chicos que participan del grupo scout (7-22 años)
 * - Pertenece a exactamente una rama
 * - Tiene cuenta personal
 */
@ChildEntity(PersonaType.PROTAGONISTA)
export class Protagonista extends Persona {
  @Column({ type: 'enum', enum: Rama })
  rama!: Rama;

  // =========================================================================
  // Documentación entregada
  // =========================================================================

  @Column({ name: 'partida_nacimiento', type: 'boolean', default: false })
  partidaNacimiento!: boolean;

  @Column({ name: 'dni', type: 'boolean', default: false })
  dni!: boolean;

  @Column({ name: 'dni_padres', type: 'boolean', default: false })
  dniPadres!: boolean;

  @Column({ name: 'carnet_obra_social', type: 'boolean', default: false })
  carnetObraSocial!: boolean;
}

/**
 * Educador: Adultos que guían a los protagonistas (22+ años)
 * - Puede pertenecer a una rama o a ninguna
 * - Tiene cuenta personal
 */
@ChildEntity(PersonaType.EDUCADOR)
export class Educador extends Persona {
  @Column({ type: 'enum', enum: Rama, nullable: true })
  rama!: Rama | null;

  @Column({ type: 'enum', enum: CargoEducador })
  cargo!: CargoEducador;
}

/**
 * PersonaExterna: Familiar, acompañante u otra persona
 * - Adelanta dinero para gastos del grupo
 * - El grupo le debe reembolsar
 * - NO tiene cuenta personal
 */
@ChildEntity(PersonaType.EXTERNA)
export class PersonaExterna extends Persona {
  @Column({ type: 'varchar', length: 100, nullable: true })
  contacto!: string | null;

  @Column({ type: 'text', nullable: true })
  notas!: string | null;
}
