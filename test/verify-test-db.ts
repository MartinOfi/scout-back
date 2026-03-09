/**
 * Verification Script for Test Database Setup
 * Run with: npx ts-node test/verify-test-db.ts
 */

import {
  setupTestDatabase,
  closeTestDatabase,
  cleanDatabase,
} from './test-setup';
import { createTestDataFactory } from './helpers/test-data-factory';
import {
  verifyDatabaseIsEmpty,
  getTableRowCount,
} from './helpers/database-cleaner';

async function main() {
  console.log('🧪 Starting Test Database Verification\n');

  try {
    // 1. Setup database connection
    console.log('1️⃣  Connecting to test database...');
    const dataSource = await setupTestDatabase();
    console.log('   ✅ Connected successfully\n');

    // 2. Clean database
    console.log('2️⃣  Cleaning database...');
    await cleanDatabase();
    console.log('   ✅ Database cleaned\n');

    // 3. Verify database is empty
    console.log('3️⃣  Verifying database is empty...');
    const isEmpty = await verifyDatabaseIsEmpty(dataSource);
    if (!isEmpty) {
      throw new Error('Database should be empty after cleanup');
    }
    console.log('   ✅ Database is empty\n');

    // 4. Test data factory
    console.log('4️⃣  Testing data factory...');
    const factory = createTestDataFactory(dataSource);

    const protagonista = await factory.protagonista.create({
      nombre: 'Test',
      apellido: 'Verification',
    });
    console.log('   ✅ Created Protagonista:', {
      id: protagonista.id,
      nombre: protagonista.nombre,
      apellido: protagonista.apellido,
      dni: protagonista.dni,
    });

    const educador = await factory.educador.create();
    console.log('   ✅ Created Educador:', {
      id: educador.id,
      nombre: educador.nombre,
      apellido: educador.apellido,
    });

    const campamento = await factory.campamento.create();
    console.log('   ✅ Created Campamento:', {
      id: campamento.id,
      nombre: campamento.nombre,
      fechaInicio: campamento.fechaInicio,
    });
    console.log('');

    // 5. Verify row counts
    console.log('5️⃣  Verifying row counts...');
    const personaCount = await getTableRowCount(dataSource, 'Persona');
    const campamentoCount = await getTableRowCount(dataSource, 'Campamento');
    const cajaCount = await getTableRowCount(dataSource, 'Caja');

    console.log(`   Persona: ${personaCount} rows`);
    console.log(`   Campamento: ${campamentoCount} rows`);
    console.log(`   Caja: ${cajaCount} rows (created by MovimientoFactory)`);

    if (personaCount !== 2 || campamentoCount !== 1) {
      throw new Error('Unexpected row counts');
    }
    console.log('   ✅ Row counts correct\n');

    // 6. Test cleanup
    console.log('6️⃣  Testing cleanup...');
    await cleanDatabase();
    const isEmptyAgain = await verifyDatabaseIsEmpty(dataSource);
    if (!isEmptyAgain) {
      throw new Error('Database should be empty after second cleanup');
    }
    console.log('   ✅ Cleanup successful\n');

    // 7. Close connection
    console.log('7️⃣  Closing connection...');
    await closeTestDatabase();
    console.log('   ✅ Connection closed\n');

    console.log('✨ All verifications passed!\n');
    console.log('📋 Summary:');
    console.log('   - Database connection works');
    console.log('   - Cleanup utilities work');
    console.log('   - Data factories work');
    console.log('   - Row counting works');
    console.log('   - Test infrastructure is ready!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    await closeTestDatabase();
    process.exit(1);
  }
}

main();
