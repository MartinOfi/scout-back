/**
 * Database Cleaner - Advanced Cleanup Utilities
 * Provides granular control over database state during testing
 */

import { DataSource, EntityMetadata } from 'typeorm';

/**
 * Truncate specific tables by entity names
 * Useful when you only need to clean specific modules
 *
 * @example
 * await truncateTables(dataSource, ['Persona', 'Movimiento']);
 */
export async function truncateTables(
  dataSource: DataSource,
  entityNames: string[]
): Promise<void> {
  await dataSource.query('SET session_replication_role = replica;');

  try {
    for (const entityName of entityNames) {
      const metadata = dataSource.getMetadata(entityName);
      await dataSource.query(
        `TRUNCATE TABLE "${metadata.tableName}" RESTART IDENTITY CASCADE;`
      );
    }
  } finally {
    await dataSource.query('SET session_replication_role = DEFAULT;');
  }
}

/**
 * Delete all rows from specific tables (soft delete friendly)
 * Unlike TRUNCATE, this respects triggers and soft delete columns
 *
 * @example
 * await deleteAllRows(dataSource, ['Persona', 'Campamento']);
 */
export async function deleteAllRows(
  dataSource: DataSource,
  entityNames: string[]
): Promise<void> {
  for (const entityName of entityNames) {
    const repository = dataSource.getRepository(entityName);
    await repository.delete({});
  }
}

/**
 * Get all table names in database
 */
export async function getAllTableNames(dataSource: DataSource): Promise<string[]> {
  const entities = dataSource.entityMetadatas;
  return entities.map((entity: EntityMetadata) => entity.tableName);
}

/**
 * Get row count for a specific table
 * Useful for verifying cleanup
 */
export async function getTableRowCount(
  dataSource: DataSource,
  entityName: string
): Promise<number> {
  const repository = dataSource.getRepository(entityName);
  return await repository.count();
}

/**
 * Verify database is empty (all tables have 0 rows)
 * Useful for test setup verification
 */
export async function verifyDatabaseIsEmpty(dataSource: DataSource): Promise<boolean> {
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const count = await getTableRowCount(dataSource, entity.name);
    if (count > 0) {
      console.warn(`⚠️  Table ${entity.tableName} has ${count} rows (expected 0)`);
      return false;
    }
  }

  return true;
}

/**
 * Reset all database sequences to 1
 * Ensures consistent IDs across test runs (if using auto-increment)
 */
export async function resetSequences(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    // Find primary key columns with sequences
    const pkColumns = entity.primaryColumns.filter(
      (col) => col.isGenerated && col.generationStrategy === 'increment'
    );

    for (const pkColumn of pkColumns) {
      const sequenceName = `${entity.tableName}_${pkColumn.databaseName}_seq`;
      try {
        await dataSource.query(`ALTER SEQUENCE "${sequenceName}" RESTART WITH 1;`);
      } catch (error) {
        // Sequence might not exist (UUID primary keys), ignore
      }
    }
  }
}

/**
 * Full database reset - most aggressive cleanup
 * Truncates all tables, resets sequences, verifies empty
 */
export async function fullDatabaseReset(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;

  await dataSource.query('SET session_replication_role = replica;');

  try {
    // Truncate all tables
    for (const entity of entities) {
      await dataSource.query(
        `TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE;`
      );
    }

    // Reset sequences
    await resetSequences(dataSource);
  } finally {
    await dataSource.query('SET session_replication_role = DEFAULT;');
  }

  // Verify
  const isEmpty = await verifyDatabaseIsEmpty(dataSource);
  if (!isEmpty) {
    throw new Error('Database cleanup failed - tables still contain data');
  }
}
