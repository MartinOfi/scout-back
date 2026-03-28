/**
 * Script to link existing EGRESO/INGRESO pairs that were created
 * before the movimientoRelacionadoId field was added.
 *
 * Criteria for matching:
 * - Same responsable_id
 * - Same campamento_id or inscripcion_id (at least one must match)
 * - EGRESO has concepto = 'uso_saldo_personal'
 * - Dates within 5 seconds of each other
 * - Neither is soft-deleted
 *
 * Note: The script also fixes INGRESO.medioPago to 'mixto' when there's
 * a physical payment component (montoIngreso > montoEgreso), since older
 * code had a bug that left medioPago as 'efectivo' instead of 'mixto'.
 *
 * Usage:
 *   npx ts-node scripts/link-related-movimientos.ts
 *
 * Or with environment variables:
 *   DATABASE_URL=postgresql://... npx ts-node scripts/link-related-movimientos.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await dataSource.initialize();
  console.log('Connected!\n');

  try {
    // First, let's see how many pairs we'll link
    // Note: Column names are a mix of snake_case (explicit name:) and camelCase (default)
    // - responsable_id, campamento_id, inscripcion_id, movimiento_relacionado_id: snake_case
    // - medioPago, deletedAt: camelCase (TypeORM default)
    //
    // Relaxed criteria: We don't filter by medioPago because older code had a bug
    // that left medioPago as 'efectivo' instead of 'mixto' for mixed payments.
    // The existence of an EGRESO with concepto='uso_saldo_personal' is definitive
    // proof that this is a mixed payment.
    const previewQuery = `
      SELECT
        ingreso.id as ingreso_id,
        egreso.id as egreso_id,
        ingreso.monto as ingreso_monto,
        egreso.monto as egreso_monto,
        ingreso."medioPago" as ingreso_medio_pago,
        ingreso.responsable_id,
        ingreso.campamento_id,
        ingreso.inscripcion_id,
        ingreso.fecha as ingreso_fecha,
        egreso.fecha as egreso_fecha
      FROM movimientos ingreso
      INNER JOIN movimientos egreso ON (
        ingreso.responsable_id = egreso.responsable_id
        AND ingreso.tipo = 'ingreso'
        AND egreso.tipo = 'egreso'
        AND egreso.concepto = 'uso_saldo_personal'
        AND ingreso.movimiento_relacionado_id IS NULL
        AND egreso.movimiento_relacionado_id IS NULL
        AND ingreso."deletedAt" IS NULL
        AND egreso."deletedAt" IS NULL
        AND ABS(EXTRACT(EPOCH FROM (ingreso.fecha - egreso.fecha))) < 5
        AND (
          (ingreso.campamento_id IS NOT NULL AND ingreso.campamento_id = egreso.campamento_id)
          OR (ingreso.inscripcion_id IS NOT NULL AND ingreso.inscripcion_id = egreso.inscripcion_id)
        )
      )
    `;

    const pairs = await dataSource.query(previewQuery);

    console.log(`Found ${pairs.length} pairs to link:\n`);

    if (pairs.length === 0) {
      console.log('No unlinked pairs found. Nothing to do.');
      await dataSource.destroy();
      return;
    }

    // Show preview
    for (const pair of pairs) {
      const montoFisico =
        Number(pair.ingreso_monto) - Number(pair.egreso_monto);
      const needsMedioPagoFix =
        montoFisico > 0 && pair.ingreso_medio_pago !== 'mixto';
      console.log(
        `  INGRESO ${pair.ingreso_id.substring(0, 8)}... ($${pair.ingreso_monto})`,
      );
      console.log(
        `  EGRESO  ${pair.egreso_id.substring(0, 8)}... ($${pair.egreso_monto})`,
      );
      console.log(
        `  Entity: ${pair.campamento_id ? 'Campamento' : 'Inscripcion'}`,
      );
      console.log(`  MedioPago: ${pair.ingreso_medio_pago}`);
      if (needsMedioPagoFix) {
        console.log(`  -> Will fix medioPago to 'mixto'`);
      }
      console.log('');
    }

    // Link INGRESO -> EGRESO and fix medioPago if needed
    console.log('Linking INGRESO -> EGRESO...');
    const result1 = await dataSource.query(`
      WITH pairs AS (
        SELECT
          ingreso.id as ingreso_id,
          egreso.id as egreso_id,
          ingreso.monto as ingreso_monto,
          egreso.monto as egreso_monto
        FROM movimientos ingreso
        INNER JOIN movimientos egreso ON (
          ingreso.responsable_id = egreso.responsable_id
          AND ingreso.tipo = 'ingreso'
          AND egreso.tipo = 'egreso'
          AND egreso.concepto = 'uso_saldo_personal'
          AND ingreso.movimiento_relacionado_id IS NULL
          AND egreso.movimiento_relacionado_id IS NULL
          AND ingreso."deletedAt" IS NULL
          AND egreso."deletedAt" IS NULL
          AND ABS(EXTRACT(EPOCH FROM (ingreso.fecha - egreso.fecha))) < 5
          AND (
            (ingreso.campamento_id IS NOT NULL AND ingreso.campamento_id = egreso.campamento_id)
            OR (ingreso.inscripcion_id IS NOT NULL AND ingreso.inscripcion_id = egreso.inscripcion_id)
          )
        )
      )
      UPDATE movimientos
      SET
        movimiento_relacionado_id = pairs.egreso_id,
        "medioPago" = CASE
          WHEN pairs.ingreso_monto > pairs.egreso_monto THEN 'mixto'::movimientos_mediopago_enum
          ELSE 'saldo_personal'::movimientos_mediopago_enum
        END
      FROM pairs
      WHERE movimientos.id = pairs.ingreso_id
    `);
    console.log(`  Updated ${result1[1]} INGRESO records`);

    // Link EGRESO -> INGRESO (reverse direction)
    // Note: We now use the movimiento_relacionado_id we just set to find pairs
    console.log('Linking EGRESO -> INGRESO (bidirectional)...');
    const result2 = await dataSource.query(`
      WITH pairs AS (
        SELECT
          ingreso.id as ingreso_id,
          egreso.id as egreso_id
        FROM movimientos ingreso
        INNER JOIN movimientos egreso ON (
          ingreso.responsable_id = egreso.responsable_id
          AND ingreso.tipo = 'ingreso'
          AND egreso.tipo = 'egreso'
          AND egreso.concepto = 'uso_saldo_personal'
          AND ingreso.movimiento_relacionado_id = egreso.id
          AND egreso.movimiento_relacionado_id IS NULL
          AND ingreso."deletedAt" IS NULL
          AND egreso."deletedAt" IS NULL
        )
      )
      UPDATE movimientos
      SET movimiento_relacionado_id = pairs.ingreso_id
      FROM pairs
      WHERE movimientos.id = pairs.egreso_id
    `);
    console.log(`  Updated ${result2[1]} EGRESO records`);

    console.log('\nDone! All pairs are now bidirectionally linked.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

main();
