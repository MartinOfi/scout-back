import { DataSource } from 'typeorm';
import { Caja } from '../../modules/cajas/entities/caja.entity';
import { Persona } from '../../modules/personas/entities/persona.entity';
import { CajaType } from '../../common/enums';

/**
 * Seed data for personal cajas
 * Creates a personal caja for each Protagonista and Educador
 * PersonaExterna does NOT get a personal caja
 */

// Persona data from CSV export (only protagonista and educador get personal caja)
const PERSONAS_DATA: Array<{ id: string; nombre: string; tipo: string }> = [
  // Protagonistas - Rovers
  {
    id: '5aa48fd7-ba64-4aaf-be14-4978e26e7cbf',
    nombre: 'Gino Correa',
    tipo: 'protagonista',
  },
  {
    id: '7e6ad7be-abe9-42f0-9290-e3d2cab1c7d6',
    nombre: 'Ramirez, Juan Pablo',
    tipo: 'protagonista',
  },
  {
    id: '09ae7c25-fa00-4a63-b991-bd8c506a0616',
    nombre: 'Correa, Gino Franco',
    tipo: 'protagonista',
  },
  {
    id: 'd7430f39-0bfe-451b-8031-de5ba9435346',
    nombre: 'Robles, Paloma Angelina',
    tipo: 'protagonista',
  },
  {
    id: '73f1eef2-3ab0-421a-bb0d-f8926ffe4a05',
    nombre: 'Martino Losada, Mateo',
    tipo: 'protagonista',
  },
  {
    id: '1c346240-4e6c-4776-9275-36187d67d43e',
    nombre: 'Lanzetti, Julian',
    tipo: 'protagonista',
  },
  {
    id: '07b63127-4796-4843-97ae-21cb24ebffec',
    nombre: 'Mai, Mateo',
    tipo: 'protagonista',
  },
  {
    id: '567d8b09-ca23-4b57-83fd-7703c65c93c6',
    nombre: 'Poggi, Angelo Carlo',
    tipo: 'protagonista',
  },
  {
    id: 'fe209da7-0f18-42cb-84f2-ade2a609bf0c',
    nombre: 'Flores, Sofia',
    tipo: 'protagonista',
  },

  // Protagonistas - Caminantes
  {
    id: '1c230687-1172-4486-aa61-d3c16bed344a',
    nombre: 'Morena Vega',
    tipo: 'protagonista',
  },
  {
    id: 'b05dcbeb-0f47-4b10-98cc-bab64b1a4019',
    nombre: 'Martinelli, Gino',
    tipo: 'protagonista',
  },
  {
    id: 'be9acae5-451c-456c-83da-1a6ab914f4c6',
    nombre: 'Dalmaso, Lourdes',
    tipo: 'protagonista',
  },
  {
    id: '8e55f416-c0ba-470c-809a-740bb19601d7',
    nombre: 'Cecchini, Bruno',
    tipo: 'protagonista',
  },
  {
    id: '6d40cea8-c78c-4316-a7a0-1c03a4d25cf7',
    nombre: 'Scaringi, Lautaro',
    tipo: 'protagonista',
  },
  {
    id: 'fa042f24-f612-4163-9d34-755ce2231f2c',
    nombre: 'Artale, Lucía',
    tipo: 'protagonista',
  },
  {
    id: 'd3b5dcd5-3236-410c-82f0-f5fe15c61392',
    nombre: 'Torres, Bahía Luz',
    tipo: 'protagonista',
  },
  {
    id: 'a74d59d6-1312-4fc4-a4da-ba230fadd0e0',
    nombre: 'Flores, Valentina',
    tipo: 'protagonista',
  },
  {
    id: '3b144fc4-6637-44a4-9b2f-5c408a225262',
    nombre: 'Maurino, Gerónimo',
    tipo: 'protagonista',
  },
  {
    id: '7bdd67f7-ee6a-4692-9b01-ffbf64462d00',
    nombre: 'Vega Aluise, Morena',
    tipo: 'protagonista',
  },
  {
    id: '90553959-772f-45eb-9647-7f3197be927a',
    nombre: 'Quevedo Giordani, Amalia Victoria',
    tipo: 'protagonista',
  },
  {
    id: '3e17085a-2d81-488d-ac1b-9c35b61dec59',
    nombre: 'González, Manuel Santiago',
    tipo: 'protagonista',
  },
  {
    id: '2492dd6a-aa68-44eb-a78b-b862d8ffa44f',
    nombre: 'Moine, Axel Dylan',
    tipo: 'protagonista',
  },
  {
    id: 'c83dca95-f297-4e87-83e5-e71478ea5948',
    nombre: 'Giacometti, Julieta Luciana',
    tipo: 'protagonista',
  },
  {
    id: 'f3d20fa7-b6e9-4c93-9bba-f9c3bd00e132',
    nombre: 'Arenas, Delfina Denis',
    tipo: 'protagonista',
  },
  {
    id: 'fa876b5e-0469-4975-abc7-64c160bccd53',
    nombre: 'Latuca, Juan Ignacio',
    tipo: 'protagonista',
  },
  {
    id: 'edbe3bb7-7d87-4855-9712-4c19accb3cc8',
    nombre: 'Rossetto, Francisco',
    tipo: 'protagonista',
  },

  // Protagonistas - Unidad
  {
    id: '147984ac-ea69-44a8-8e89-a9abb2e22015',
    nombre: 'Ferrari, Bruno',
    tipo: 'protagonista',
  },
  {
    id: '11f590f8-db5d-41fd-893b-2bfb188b0bf9',
    nombre: 'Scapin, Nicolas Martin',
    tipo: 'protagonista',
  },
  {
    id: '3602540c-18ae-462c-bd40-fe64abbba598',
    nombre: 'Duarte, Sofia',
    tipo: 'protagonista',
  },
  {
    id: 'ca37ea69-f9a4-41cd-9825-dd0e43a34b1c',
    nombre: 'Dose, Nina',
    tipo: 'protagonista',
  },
  {
    id: '34f4100d-0f3b-468d-b1f9-59183931d8a0',
    nombre: 'Leguizamon, Emily',
    tipo: 'protagonista',
  },
  {
    id: '80657db5-dfa6-4d0f-bad0-80c50f57e2a7',
    nombre: 'Ponce Maldonado, Amanda',
    tipo: 'protagonista',
  },
  {
    id: 'ed8bc9e7-7878-4a32-93d1-432564edd747',
    nombre: 'Ojeda, Angel Demian',
    tipo: 'protagonista',
  },
  {
    id: '85dac5b3-d669-45b0-85e7-6039d17e82f1',
    nombre: 'Cejas, Jeremias Eluney',
    tipo: 'protagonista',
  },
  {
    id: 'fdc4a50a-ab7a-4899-adfb-61aa8b62ead5',
    nombre: 'Oviedo, Giuliano',
    tipo: 'protagonista',
  },
  {
    id: 'af704265-b9ee-4106-9292-47faa0983c84',
    nombre: 'Delgau Sosa, Auriazul',
    tipo: 'protagonista',
  },
  {
    id: '67a5815e-77d7-45f7-9c24-82d860a6c217',
    nombre: 'Vaudagna, Francisco',
    tipo: 'protagonista',
  },
  {
    id: 'c8c3eb39-8b8c-451b-a880-75f6240e82fd',
    nombre: 'Enriquez Salguero, Rodrigo Alejandro',
    tipo: 'protagonista',
  },
  {
    id: 'dbf777bf-5e34-41c4-9ecd-2dbce4c1badd',
    nombre: 'Storni Alem, Sofia Isolina Del Carmen',
    tipo: 'protagonista',
  },
  {
    id: 'f1adf924-d734-4404-8222-102e036a1b89',
    nombre: 'Sarzoza Rojas, Lara Elena',
    tipo: 'protagonista',
  },

  // Protagonistas - Manada
  {
    id: '3456253d-3953-4adb-a7c5-a82f61461f3b',
    nombre: 'Acevedo Merlo, Santiago',
    tipo: 'protagonista',
  },
  {
    id: '50c9a862-5902-4d62-9e01-b6e1b329d8d1',
    nombre: 'Caruso, Olivia',
    tipo: 'protagonista',
  },
  {
    id: '7e30a9d3-da33-4586-abf7-d4cb4af30537',
    nombre: 'Bullano, Olivia',
    tipo: 'protagonista',
  },
  {
    id: 'bc154d20-8732-4504-9eef-083f6a0359e2',
    nombre: 'Correa, Lautaro',
    tipo: 'protagonista',
  },
  {
    id: '33f4bf4f-b815-47e3-bf2d-71a6a0b6df25',
    nombre: 'Ramirez, Guadalupe',
    tipo: 'protagonista',
  },
  {
    id: '219be960-2555-4d06-8187-26ef3943a43e',
    nombre: 'Espinosa, Julian',
    tipo: 'protagonista',
  },
  {
    id: 'c20c38b2-97f8-4915-aea9-96a39120f71e',
    nombre: 'Di Carlo Padularrosa, Umma',
    tipo: 'protagonista',
  },
  {
    id: 'c2211e93-390f-4fba-a28b-e92ffce591ba',
    nombre: 'Gamarra, Sofia',
    tipo: 'protagonista',
  },
  {
    id: 'bac11da6-dee9-4d6c-ad54-2ec132b223ae',
    nombre: 'Escobar, Nahomi',
    tipo: 'protagonista',
  },
  {
    id: '308af8d8-9eae-41c1-951e-c36dc53f5724',
    nombre: 'Brollo Vaccari, Mateo',
    tipo: 'protagonista',
  },
  {
    id: '391262b5-b6b7-461c-acee-f214a92e4199',
    nombre: 'Moine, Giovanni',
    tipo: 'protagonista',
  },
  {
    id: 'a6b80af3-d77f-4f15-8108-473250e9d6f6',
    nombre: 'Roldán, Santino',
    tipo: 'protagonista',
  },
  {
    id: '6933d5a2-6b35-4e8b-9555-004993c5697f',
    nombre: 'Rosa Genes, Valentina',
    tipo: 'protagonista',
  },
  {
    id: 'fddf3b6d-57ed-4f38-8666-c6d4fe8562b7',
    nombre: 'Ruiz, Delfina Luz',
    tipo: 'protagonista',
  },

  // Educadores
  {
    id: '08dc4ddd-45cf-443c-a3c9-fcbc22f50830',
    nombre: 'Garcia, Héctor Anibal',
    tipo: 'educador',
  },
  {
    id: 'e8b5afe0-a033-499a-8810-1795f5331fe4',
    nombre: 'González, Ariel Gustavo',
    tipo: 'educador',
  },
  {
    id: '09c0d037-060e-448b-8e14-d3f0b8c6ac94',
    nombre: 'Álvarez, Erica',
    tipo: 'educador',
  },
  {
    id: 'bd5cc037-2748-4ee3-b65a-cb20d7a93486',
    nombre: 'Anzoategui, Mora Sabrina',
    tipo: 'educador',
  },
  {
    id: '8766d17d-e5c8-482a-aa60-7993f2ccfb26',
    nombre: 'Martinez, Melina Belén',
    tipo: 'educador',
  },
  {
    id: '9933f7bc-a44a-4764-9868-3f892b1fc65e',
    nombre: 'Garcia, Matias Andres',
    tipo: 'educador',
  },
  {
    id: '6dfa0192-4951-4f45-a1e3-b6ff0737cc70',
    nombre: 'Pilón, Bárbara',
    tipo: 'educador',
  },
  {
    id: '67905682-05c8-4f05-98bf-12352cf450ea',
    nombre: 'Kuschnir, Julieta',
    tipo: 'educador',
  },
  {
    id: '1ed972ac-d37f-4bde-b7b4-7544f8dcd5b0',
    nombre: 'Oficialdegui, Martín',
    tipo: 'educador',
  },
  {
    id: 'dcb2db7b-f78d-4e88-a4b9-260ed467ca9f',
    nombre: 'Gonzalez, Ignacio',
    tipo: 'educador',
  },
  {
    id: 'e2dc7533-c92e-49c7-b8b6-f01dbe1bf00b',
    nombre: 'Roura, Agustina',
    tipo: 'educador',
  },
  {
    id: 'cd92b483-32bc-4ca3-958f-a3a7c20d3d48',
    nombre: 'Pujol Combin, Candela',
    tipo: 'educador',
  },
  {
    id: '73f8623d-c3d7-4a47-ad03-6eebf6e46544',
    nombre: 'Tranier, Juliana Elena',
    tipo: 'educador',
  },
  {
    id: 'ebf1f742-873e-43fe-b3ca-0aac71d8fb9a',
    nombre: 'Pugliese, Lucas Nahuel',
    tipo: 'educador',
  },
  {
    id: '26b5800e-672d-40b6-ae12-8c364c9bbca3',
    nombre: 'Pacenza, Sofia',
    tipo: 'educador',
  },
  {
    id: 'd6134b36-1f98-4ce8-8662-018c772f2d52',
    nombre: 'Segovia, Adolfo',
    tipo: 'educador',
  },
  {
    id: '611a444d-537c-4aab-b003-c6ad519b13ea',
    nombre: 'Gómez, Maria Eugenia',
    tipo: 'educador',
  },
  {
    id: '4a7aae9a-fb95-43a5-9614-48f2164a4010',
    nombre: 'Gamarra, Julio Cesar',
    tipo: 'educador',
  },
];

export async function seedCajasPersonales(
  dataSource: DataSource,
): Promise<void> {
  const cajaRepository = dataSource.getRepository(Caja);
  const personaRepository = dataSource.getRepository(Persona);

  let created = 0;
  let skipped = 0;
  let notFound = 0;

  for (const personaData of PERSONAS_DATA) {
    // Skip if not protagonista or educador (externo doesn't get personal caja)
    if (
      personaData.tipo !== 'protagonista' &&
      personaData.tipo !== 'educador'
    ) {
      continue;
    }

    // Verify persona exists in database
    const persona = await personaRepository.findOne({
      where: { id: personaData.id },
    });

    if (!persona) {
      console.log(
        `⚠ Persona not found: ${personaData.nombre} (${personaData.id})`,
      );
      notFound++;
      continue;
    }

    // Check if personal caja already exists for this persona
    const existingCaja = await cajaRepository.findOne({
      where: {
        tipo: CajaType.PERSONAL,
        propietarioId: personaData.id,
      },
    });

    if (existingCaja) {
      console.log(`- Caja already exists for: ${personaData.nombre}`);
      skipped++;
      continue;
    }

    // Create personal caja
    const caja = cajaRepository.create({
      tipo: CajaType.PERSONAL,
      nombre: `Cuenta ${personaData.nombre}`,
      propietarioId: personaData.id,
    });

    await cajaRepository.save(caja);
    console.log(`✓ Created personal caja for: ${personaData.nombre}`);
    created++;
  }

  console.log('');
  console.log(
    `Summary: ${created} created, ${skipped} skipped (already exist), ${notFound} personas not found`,
  );
}
