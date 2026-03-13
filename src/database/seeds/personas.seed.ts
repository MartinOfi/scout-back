import { DataSource } from 'typeorm';
import {
  Protagonista,
  Educador,
  PersonaExterna,
} from '../../modules/personas/entities/persona.entity';
import { Rama, CargoEducador, EstadoPersona } from '../../common/enums';

/**
 * Seed data for Educadores (adults 22+)
 */
interface EducadorData {
  nombre: string;
  rama: Rama | null;
  cargo: CargoEducador;
}

const EDUCADORES: EducadorData[] = [
  {
    nombre: 'Garcia, Héctor Anibal',
    rama: null,
    cargo: CargoEducador.EDUCADOR,
  },
  {
    nombre: 'González, Ariel Gustavo',
    rama: null,
    cargo: CargoEducador.EDUCADOR,
  },
  { nombre: 'Álvarez, Erica', rama: null, cargo: CargoEducador.EDUCADOR },
  {
    nombre: 'Anzoategui, Mora Sabrina',
    rama: null,
    cargo: CargoEducador.EDUCADOR,
  },
  {
    nombre: 'Martinez, Melina Belén',
    rama: null,
    cargo: CargoEducador.EDUCADOR,
  },
  {
    nombre: 'Garcia, Matias Andres',
    rama: null,
    cargo: CargoEducador.EDUCADOR,
  },
  { nombre: 'Pilón, Bárbara', rama: null, cargo: CargoEducador.EDUCADOR },
  { nombre: 'Kuschnir, Julieta', rama: null, cargo: CargoEducador.EDUCADOR },
  { nombre: 'Oficialdegui, Martín', rama: null, cargo: CargoEducador.EDUCADOR },
  { nombre: 'Gonzalez, Ignacio', rama: null, cargo: CargoEducador.EDUCADOR },
  { nombre: 'Roura, Agustina', rama: null, cargo: CargoEducador.EDUCADOR },
  {
    nombre: 'Pujol Combin, Candela',
    rama: null,
    cargo: CargoEducador.EDUCADOR,
  },
  {
    nombre: 'Tranier, Juliana Elena',
    rama: null,
    cargo: CargoEducador.EDUCADOR,
  },
  {
    nombre: 'Pugliese, Lucas Nahuel',
    rama: null,
    cargo: CargoEducador.EDUCADOR,
  },
  { nombre: 'Pacenza, Sofia', rama: null, cargo: CargoEducador.EDUCADOR },
  { nombre: 'Segovia, Adolfo', rama: null, cargo: CargoEducador.EDUCADOR },
  { nombre: 'Gómez, Maria Eugenia', rama: null, cargo: CargoEducador.EDUCADOR },
  { nombre: 'Gamarra, Julio Cesar', rama: null, cargo: CargoEducador.EDUCADOR },
];

/**
 * Seed data for Protagonistas (scouts 7-22 years)
 * All documentation fields set to true
 */
interface ProtagonistaData {
  nombre: string;
  rama: Rama;
  partidaNacimiento: boolean;
  dni: boolean;
  dniPadres: boolean;
  carnetObraSocial: boolean;
}

const PROTAGONISTAS: ProtagonistaData[] = [
  // Rovers (17-22 años)
  {
    nombre: 'Ramirez, Juan Pablo',
    rama: Rama.ROVERS,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Correa, Gino Franco',
    rama: Rama.ROVERS,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Robles, Paloma Angelina',
    rama: Rama.ROVERS,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Martino Losada, Mateo',
    rama: Rama.ROVERS,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Frisari, Mateo',
    rama: Rama.ROVERS,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Poggi, Angelo Carlo',
    rama: Rama.ROVERS,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Flores, Sofia',
    rama: Rama.ROVERS,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },

  // Caminantes (14-17 años)
  {
    nombre: 'Martinelli, Gino',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Dalmaso, Lourdes',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Cecchini, Bruno',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Scaringi, Lautaro',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Artale, Lucía',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Torres, Bahía Luz',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Flores, Valentina',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Maurino, Gerónimo',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Vega Aluise, Morena',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Quevedo Giordani, Amalia Victoria',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'González, Manuel Santiago',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Moine, Axel Dylan',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Giacometti, Julieta Luciana',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Arenas, Delfina Denis',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Latuca, Juan Ignacio',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Rossetto, Francisco',
    rama: Rama.CAMINANTES,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },

  // Unidad / Scout (11-14 años)
  {
    nombre: 'Ferrari, Bruno',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Scapin, Nicolas Martin',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Duarte, Sofia',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Dose, Nina',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Leguizamon, Emily',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Ponce Maldonado, Amanda',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Ojeda, Angel Demian',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Cejas, Jeremias Eluney',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Oviedo, Giuliano',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Delgau Sosa, Auriazul',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Vaudagna, Francisco',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Enriquez Salguero, Rodrigo Alejandro',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Storni Alem, Sofia Isolina Del Carmen',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Sarzoza Rojas, Lara Elena',
    rama: Rama.UNIDAD,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },

  // Manada (7-11 años)
  {
    nombre: 'Lanzetti, Julian',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Acevedo Merlo, Santiago',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Caruso, Olivia',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Bullano, Olivia',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Correa, Lautaro',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Ramirez, Guadalupe',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Espinosa, Julian',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Di Carlo Padularrosa, Umma',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Gamarra, Sofia',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Escobar, Nahomi',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Brollo Vaccari, Mateo',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Moine, Giovanni',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Roldán, Santino',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Rosa Genes, Valentina',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
  {
    nombre: 'Ruiz, Delfina Luz',
    rama: Rama.MANADA,
    partidaNacimiento: true,
    dni: true,
    dniPadres: true,
    carnetObraSocial: true,
  },
];

/**
 * Seed data for PersonasExternas (family members, etc.)
 */
interface PersonaExternaData {
  nombre: string;
  contacto: string | null;
  notas: string | null;
}

const PERSONAS_EXTERNAS: PersonaExternaData[] = [
  // Add external people here if needed
];

export async function seedPersonas(dataSource: DataSource): Promise<void> {
  const protagonistaRepo = dataSource.getRepository(Protagonista);
  const educadorRepo = dataSource.getRepository(Educador);
  const personaExternaRepo = dataSource.getRepository(PersonaExterna);

  // Seed Educadores
  console.log('\n--- Educadores ---');
  for (const data of EDUCADORES) {
    const existing = await educadorRepo.findOne({
      where: { nombre: data.nombre },
    });

    if (!existing) {
      const educador = educadorRepo.create({
        nombre: data.nombre,
        rama: data.rama,
        cargo: data.cargo,
        estado: EstadoPersona.ACTIVO,
      });
      await educadorRepo.save(educador);
      console.log(
        `✓ Created educador: ${data.nombre} (${data.cargo}${data.rama ? `, ${data.rama}` : ''})`,
      );
    } else {
      console.log(`- Educador already exists: ${data.nombre}`);
    }
  }

  // Seed Protagonistas
  console.log('\n--- Protagonistas ---');
  for (const data of PROTAGONISTAS) {
    const existing = await protagonistaRepo.findOne({
      where: { nombre: data.nombre },
    });

    if (!existing) {
      const protagonista = protagonistaRepo.create({
        nombre: data.nombre,
        rama: data.rama,
        estado: EstadoPersona.ACTIVO,
        partidaNacimiento: data.partidaNacimiento,
        dni: data.dni,
        dniPadres: data.dniPadres,
        carnetObraSocial: data.carnetObraSocial,
      });
      await protagonistaRepo.save(protagonista);
      const docsCount = [
        data.partidaNacimiento,
        data.dni,
        data.dniPadres,
        data.carnetObraSocial,
      ].filter(Boolean).length;
      console.log(
        `✓ Created protagonista: ${data.nombre} (${data.rama}, ${docsCount}/4 docs)`,
      );
    } else {
      console.log(`- Protagonista already exists: ${data.nombre}`);
    }
  }

  // Seed Personas Externas
  if (PERSONAS_EXTERNAS.length > 0) {
    console.log('\n--- Personas Externas ---');
    for (const data of PERSONAS_EXTERNAS) {
      const existing = await personaExternaRepo.findOne({
        where: { nombre: data.nombre },
      });

      if (!existing) {
        const personaExterna = personaExternaRepo.create({
          nombre: data.nombre,
          contacto: data.contacto,
          notas: data.notas,
          estado: EstadoPersona.ACTIVO,
        });
        await personaExternaRepo.save(personaExterna);
        console.log(`✓ Created persona externa: ${data.nombre}`);
      } else {
        console.log(`- Persona externa already exists: ${data.nombre}`);
      }
    }
  }

  console.log(
    `\n✓ Seed completed: ${EDUCADORES.length} educadores, ${PROTAGONISTAS.length} protagonistas`,
  );
}
