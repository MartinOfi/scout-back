/**
 * Test Setup - Global Test Configuration
 * Provides database initialization, cleanup, and seeding utilities
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

let testDataSource: DataSource | null = null;

/**
 * Initialize test database connection
 * Uses .env.test configuration
 */
export async function setupTestDatabase(): Promise<DataSource> {
  if (testDataSource?.isInitialized) {
    return testDataSource;
  }

  // Load test environment variables
  process.env.NODE_ENV = 'test';
  dotenv.config({ path: path.join(__dirname, '../.env.test') });

  testDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
    synchronize: true, // Auto-create tables (only safe for test DB!)
    dropSchema: false,  // Don't drop on every connection (we control cleanup)
    logging: false,     // Disable SQL logging for cleaner test output
  });

  await testDataSource.initialize();
  console.log('✅ Test database connected');

  return testDataSource;
}

/**
 * Close test database connection
 */
export async function closeTestDatabase(): Promise<void> {
  if (testDataSource?.isInitialized) {
    await testDataSource.destroy();
    testDataSource = null;
    console.log('✅ Test database disconnected');
  }
}

/**
 * Get current test data source
 */
export function getTestDataSource(): DataSource {
  if (!testDataSource?.isInitialized) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDataSource;
}

/**
 * Clean all tables in database
 * Truncates all tables and resets sequences
 * Maintains referential integrity by cascading
 */
export async function cleanDatabase(): Promise<void> {
  const dataSource = getTestDataSource();

  const entities = dataSource.entityMetadatas;

  // Disable foreign key checks temporarily (PostgreSQL)
  await dataSource.query('SET session_replication_role = replica;');

  try {
    // Truncate all tables
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE;`);
    }
  } finally {
    // Re-enable foreign key checks
    await dataSource.query('SET session_replication_role = DEFAULT;');
  }

  console.log('🧹 Database cleaned');
}

/**
 * Seed baseline data needed for tests
 * Creates essential entities that many tests depend on
 */
export async function seedBaselineData(): Promise<void> {
  // TODO: Implement baseline data seeding
  // Examples:
  // - Create caja grupo (required for many operations)
  // - Create cajas for each rama
  // - Create default roles/permissions (if using RBAC)

  console.log('🌱 Baseline data seeded');
}

/**
 * Reset database to clean state
 * Combines clean + seed for convenience
 */
export async function resetDatabase(): Promise<void> {
  await cleanDatabase();
  await seedBaselineData();
}

/**
 * Jest global setup hook
 * Called once before all test suites
 */
export async function globalSetup(): Promise<void> {
  console.log('🚀 Starting test database setup...');
  await setupTestDatabase();
  await resetDatabase();
}

/**
 * Jest global teardown hook
 * Called once after all test suites
 */
export async function globalTeardown(): Promise<void> {
  console.log('🛑 Shutting down test database...');
  await closeTestDatabase();
}
