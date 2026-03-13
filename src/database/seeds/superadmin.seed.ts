import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Educador } from '../../modules/personas/entities/persona.entity';
import { CargoEducador, EstadoPersona } from '../../common/enums';

const SALT_ROUNDS = 12;

const SUPERADMIN_DATA = {
  nombre: 'Super Admin',
  email: 'superadmin@scout.com',
  password: 'Admin123!',
  cargo: CargoEducador.JEFE_DE_GRUPO,
};

export async function seedSuperadmin(dataSource: DataSource): Promise<void> {
  const educadorRepo = dataSource.getRepository(Educador);

  // Check if superadmin already exists by email
  const existing = await educadorRepo
    .createQueryBuilder('educador')
    .where('educador.email = :email', { email: SUPERADMIN_DATA.email })
    .getOne();

  if (existing) {
    console.log(`- Superadmin already exists: ${SUPERADMIN_DATA.email}`);
    return;
  }

  // Hash password with bcrypt (same as PasswordService)
  const passwordHash = await bcrypt.hash(SUPERADMIN_DATA.password, SALT_ROUNDS);

  const superadmin = educadorRepo.create({
    nombre: SUPERADMIN_DATA.nombre,
    email: SUPERADMIN_DATA.email,
    passwordHash,
    emailVerified: true,
    rama: null,
    cargo: SUPERADMIN_DATA.cargo,
    estado: EstadoPersona.ACTIVO,
  });

  await educadorRepo.save(superadmin);
  console.log(`✓ Created superadmin: ${SUPERADMIN_DATA.email}`);
  console.log(`  Password: ${SUPERADMIN_DATA.password} (bcrypt hashed)`);
}
