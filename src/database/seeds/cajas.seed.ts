import { DataSource } from 'typeorm';
import { Caja } from '../../modules/cajas/entities/caja.entity';
import { CajaType } from '../../common/enums';

/**
 * Seed data for system cajas (Grupo + Ramas)
 * These are required for the system to work properly
 */
const CAJAS_SISTEMA: Array<{ tipo: CajaType; nombre: string }> = [
  { tipo: CajaType.GRUPO, nombre: 'Caja del Grupo' },
  { tipo: CajaType.RAMA_MANADA, nombre: 'Fondo Manada' },
  { tipo: CajaType.RAMA_UNIDAD, nombre: 'Fondo Unidad' },
  { tipo: CajaType.RAMA_CAMINANTES, nombre: 'Fondo Caminantes' },
  { tipo: CajaType.RAMA_ROVERS, nombre: 'Fondo Rovers' },
];

export async function seedCajas(dataSource: DataSource): Promise<void> {
  const cajaRepository = dataSource.getRepository(Caja);

  for (const cajaData of CAJAS_SISTEMA) {
    // Check if caja already exists (idempotent seed)
    const existing = await cajaRepository.findOne({
      where: { tipo: cajaData.tipo },
    });

    if (!existing) {
      const caja = cajaRepository.create({
        tipo: cajaData.tipo,
        nombre: cajaData.nombre,
        propietarioId: null,
      });
      await cajaRepository.save(caja);
      console.log(`✓ Created caja: ${cajaData.nombre}`);
    } else {
      console.log(`- Caja already exists: ${cajaData.nombre}`);
    }
  }
}
