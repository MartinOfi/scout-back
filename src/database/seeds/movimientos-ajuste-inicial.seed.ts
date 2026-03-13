import { DataSource } from 'typeorm';
import { Movimiento } from '../../modules/movimientos/entities/movimiento.entity';
import { Caja } from '../../modules/cajas/entities/caja.entity';
import {
  TipoMovimiento,
  ConceptoMovimiento,
  MedioPago,
  EstadoPago,
} from '../../common/enums';

/**
 * Seed data for initial adjustment movements (ajuste_inicial)
 * Creates initial balance movements for personal cajas
 */

// Data format: { personaId, cajaId, nombre, monto }
const AJUSTES_INICIALES: Array<{
  personaId: string;
  cajaId: string;
  nombre: string;
  monto: number;
}> = [
  {
    personaId: '6933d5a2-6b35-4e8b-9555-004993c5697f',
    cajaId: '24b34cb5-b687-42bf-9f7b-f17b0040f850',
    nombre: 'Rosa Genes, Valentina',
    monto: 4000,
  },
  {
    personaId: 'a6b80af3-d77f-4f15-8108-473250e9d6f6',
    cajaId: 'ab05303c-f225-428d-acf6-a2d30ba7e603',
    nombre: 'Roldán, Santino',
    monto: 6000,
  },
  {
    personaId: '391262b5-b6b7-461c-acee-f214a92e4199',
    cajaId: '5b3ad033-b24b-4ac3-a574-d81d882c2dd5',
    nombre: 'Moine, Giovanni',
    monto: 4000,
  },
  {
    personaId: '308af8d8-9eae-41c1-951e-c36dc53f5724',
    cajaId: '29fa8f81-8ef7-4c1f-bac2-982f778247b5',
    nombre: 'Brollo Vaccari, Mateo',
    monto: 4000,
  },
  {
    personaId: 'bac11da6-dee9-4d6c-ad54-2ec132b223ae',
    cajaId: 'e45f7240-1457-440e-987d-e78b49f45152',
    nombre: 'Escobar, Nahomi',
    monto: 4000,
  },
  {
    personaId: '7e30a9d3-da33-4586-abf7-d4cb4af30537',
    cajaId: '7fded3bf-fca3-4875-a2d9-6748537babf6',
    nombre: 'Bullano, Olivia',
    monto: 10000,
  },
  {
    personaId: '34f4100d-0f3b-468d-b1f9-59183931d8a0',
    cajaId: '31a496d8-10fa-46cf-8007-d76c3b94c02e',
    nombre: 'Leguizamon, Emily',
    monto: 4000,
  },
  {
    personaId: '147984ac-ea69-44a8-8e89-a9abb2e22015',
    cajaId: '94a0cab2-9b4f-434b-890d-6718f04c6753',
    nombre: 'Ferrari, Bruno',
    monto: 8000,
  },
  {
    personaId: 'fa876b5e-0469-4975-abc7-64c160bccd53',
    cajaId: 'ef83d00d-29bb-4c9b-8159-5770fd7277e1',
    nombre: 'Latuca, Juan Ignacio',
    monto: 8000,
  },
  {
    personaId: 'a74d59d6-1312-4fc4-a4da-ba230fadd0e0',
    cajaId: '8d47e9e5-3ddd-419e-91fa-72e3ce000fb8',
    nombre: 'Flores, Vlentina',
    monto: 4000,
  },
  {
    personaId: 'fa042f24-f612-4163-9d34-755ce2231f2c',
    cajaId: '9944fbdf-2a94-4920-aadf-a17ca9c144c0',
    nombre: 'Artale, Lucía',
    monto: 8000,
  },
  {
    personaId: '6d40cea8-c78c-4316-a7a0-1c03a4d25cf7',
    cajaId: '75499581-25ed-4ec8-b075-c808faa7bd91',
    nombre: 'Scaringi, Lautaro',
    monto: 669,
  },
  {
    personaId: 'b05dcbeb-0f47-4b10-98cc-bab64b1a4019',
    cajaId: 'ffd726a7-f4e7-4d96-9bca-d6eb66c0ff6c',
    nombre: 'Martinelli, Gino',
    monto: 400,
  },
  {
    personaId: '1c346240-4e6c-4776-9275-36187d67d43e',
    cajaId: '28bdbb71-7896-4a91-bd75-f0cf11774e02',
    nombre: 'Lanzetti, Julian',
    monto: 10000,
  },
  {
    personaId: '26b5800e-672d-40b6-ae12-8c364c9bbca3',
    cajaId: 'f7556a4f-861b-4025-a546-621a4f5ffed3',
    nombre: 'Pacenza, Sofia',
    monto: 1000,
  },
  {
    personaId: 'e2dc7533-c92e-49c7-b8b6-f01dbe1bf00b',
    cajaId: 'e62d147a-772b-4036-bbb1-52c63b2102c3',
    nombre: 'Roura, Agustina',
    monto: 14500,
  },
  {
    personaId: 'dcb2db7b-f78d-4e88-a4b9-260ed467ca9f',
    cajaId: 'c5c44b41-de32-441f-8c42-f012c87f039c',
    nombre: 'Gonzalez, Ignacio',
    monto: 3100,
  },
  {
    personaId: '1ed972ac-d37f-4bde-b7b4-7544f8dcd5b0',
    cajaId: 'afff310d-32fb-42a3-9d4a-9939e623aa66',
    nombre: 'Oficialdegui, Martín',
    monto: 7400,
  },
  {
    personaId: '6dfa0192-4951-4f45-a1e3-b6ff0737cc70',
    cajaId: '30ecd633-95de-440d-ab50-d613ffef1784',
    nombre: 'Pilón, Bárbara',
    monto: 3000,
  },
  {
    personaId: 'f3d20fa7-b6e9-4c93-9bba-f9c3bd00e132',
    cajaId: '53326d2f-9d1f-4409-aafe-22fbb787ea9c',
    nombre: 'Arenas, Dna Denis',
    monto: 844,
  },
  {
    personaId: '85dac5b3-d669-45b0-85e7-6039d17e82f1',
    cajaId: '8f4f6b82-6303-4c63-9f8c-745c6f0e70bf',
    nombre: 'Cejas, Jeremias Eluney',
    monto: 33100,
  },
  {
    personaId: '90553959-772f-45eb-9647-7f3197be927a',
    cajaId: '85b0b2b9-6888-4579-ba5b-40b2886bc086',
    nombre: 'Quevedo Giordani, Amalia Victoria',
    monto: 54900,
  },
  {
    personaId: '11f590f8-db5d-41fd-893b-2bfb188b0bf9',
    cajaId: 'dbf71139-88de-48e8-b2f5-de7b7a1573b4',
    nombre: 'Scapin, Nicolas Martin',
    monto: 8000,
  },
  {
    personaId: '2492dd6a-aa68-44eb-a78b-b862d8ffa44f',
    cajaId: '34cf00ba-cebe-4249-a655-a42d9b772294',
    nombre: 'Moine, Axel Dylan',
    monto: 16900,
  },
  {
    personaId: '09ae7c25-fa00-4a63-b991-bd8c506a0616',
    cajaId: '6de3bcbd-1d4f-4f27-b8f7-8d4947907aac',
    nombre: 'Correa, Gino Franco',
    monto: 7300,
  },
  {
    personaId: 'cd92b483-32bc-4ca3-958f-a3a7c20d3d48',
    cajaId: '193a0932-f932-466f-ad4f-4ca9370eb4d5',
    nombre: 'Pujol Combin, Candela',
    monto: 23650,
  },
  {
    personaId: 'edbe3bb7-7d87-4855-9712-4c19accb3cc8',
    cajaId: 'b75871d7-2ee3-42c8-83c0-05f6ef3d778f',
    nombre: 'Rosetto, Francisco',
    monto: 16500,
  },
  {
    personaId: 'f1adf924-d734-4404-8222-102e036a1b89',
    cajaId: 'a3ac5773-de48-48ec-b395-f9b45ce6ecbd',
    nombre: 'Zarzosa, Lara',
    monto: 55600,
  },
  {
    personaId: '67905682-05c8-4f05-98bf-12352cf450ea',
    cajaId: 'f931aee8-476a-488e-b8a9-e763b235ed2f',
    nombre: 'Kuschnir, Julieta',
    monto: 1500,
  },
  {
    personaId: 'fe209da7-0f18-42cb-84f2-ade2a609bf0c',
    cajaId: 'b1868ea7-a5f6-48c7-878d-c381bc5786e4',
    nombre: 'Flores, Sofia Agustina',
    monto: 5514,
  },
  {
    personaId: '07b63127-4796-4843-97ae-21cb24ebffec',
    cajaId: 'be14a998-337e-4b3b-89d1-89acdeb41bda',
    nombre: 'Frisari, Mateo',
    monto: 4000,
  },
  {
    personaId: '5421b5f9-0aeb-44e5-a0a6-2a2f40f57300',
    cajaId: '41a6da35-8b7a-48fe-8f79-c24c2d978be7',
    nombre: 'Godoy, Nicolas',
    monto: 4000,
  },
  {
    personaId: 'fa16c40a-9f90-487f-98e3-c702d1aea1af',
    cajaId: '82d30f75-66cd-4fa3-bb07-cde3fe030f6c',
    nombre: 'Martinez, Solana Rocio',
    monto: 783,
  },
];

// Responsable ID (educador who registers the movements)
const RESPONSABLE_ID = '9933f7bc-a44a-4764-9868-3f892b1fc65e';

// Movement date
const FECHA_MOVIMIENTO = new Date('2026-03-13T18:00:00-03:00');

export async function seedMovimientosAjusteInicial(
  dataSource: DataSource,
): Promise<void> {
  const movimientoRepository = dataSource.getRepository(Movimiento);
  const cajaRepository = dataSource.getRepository(Caja);

  let created = 0;
  let skipped = 0;
  let cajaNotFound = 0;

  for (const ajuste of AJUSTES_INICIALES) {
    // Verify caja exists
    const caja = await cajaRepository.findOne({
      where: { id: ajuste.cajaId },
    });

    if (!caja) {
      console.log(`⚠ Caja not found: ${ajuste.cajaId} for ${ajuste.nombre}`);
      cajaNotFound++;
      continue;
    }

    // Check if adjustment movement already exists for this caja
    const existingMovimiento = await movimientoRepository.findOne({
      where: {
        cajaId: ajuste.cajaId,
        concepto: ConceptoMovimiento.AJUSTE_INICIAL,
      },
    });

    if (existingMovimiento) {
      console.log(`- Ajuste already exists for: ${ajuste.nombre}`);
      skipped++;
      continue;
    }

    // Create initial adjustment movement
    const movimiento = movimientoRepository.create({
      cajaId: ajuste.cajaId,
      tipo: TipoMovimiento.INGRESO,
      monto: ajuste.monto,
      concepto: ConceptoMovimiento.AJUSTE_INICIAL,
      descripcion: `Saldo inicial migrado - ${ajuste.nombre}`,
      responsableId: RESPONSABLE_ID,
      medioPago: MedioPago.EFECTIVO,
      requiereComprobante: false,
      comprobanteEntregado: null,
      estadoPago: EstadoPago.PAGADO,
      personaAReembolsarId: null,
      fecha: FECHA_MOVIMIENTO,
      eventoId: null,
      campamentoId: null,
      inscripcionId: null,
      cuotaId: null,
      registradoPorId: null,
    });

    await movimientoRepository.save(movimiento);
    console.log(
      `✓ Created ajuste inicial for: ${ajuste.nombre} - $${ajuste.monto}`,
    );
    created++;
  }

  console.log('');
  console.log(
    `Summary: ${created} created, ${skipped} skipped (already exist), ${cajaNotFound} cajas not found`,
  );
}
