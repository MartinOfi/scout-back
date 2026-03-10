import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { seedCajas } from './cajas.seed';

// Load environment variables
config({ path: '.env.local' });

async function runSeeds(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
    synchronize: false,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('Connecting to database...');
    await dataSource.initialize();
    console.log('Database connected.\n');

    console.log('Running seeds...\n');

    // Run cajas seed
    console.log('=== Seeding Cajas ===');
    await seedCajas(dataSource);
    console.log('');

    console.log('All seeds completed successfully!');
  } catch (error) {
    console.error('Error running seeds:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

runSeeds();
