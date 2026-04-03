/**
 * CIVILDESK — Reset de base de datos
 * Borra TODOS los datos dejando las tablas vacías y listas para el seed
 *
 * ⚠️  IRREVERSIBLE — solo usar en desarrollo
 *
 * Uso: node src/config/reset.js
 */

require('dotenv').config();
const { sequelize, connectDB } = require('./database');
const { QueryTypes } = require('sequelize');

const reset = async () => {
  await connectDB();
  console.log('⚠️  CIVILDESK — Reset de base de datos\n');

  // Deshabilitar FK checks temporalmente para truncar sin orden
  await sequelize.query('SET session_replication_role = replica;');

  const tables = [
    'audit_logs',
    'alerts',
    'warehouse_savings',
    'inventory_movements',
    'warehouse_items',
    'warehouses',
    'financial_transactions',
    'report_photos',
    'report_contractors',
    'report_purchases',
    'daily_reports',
    'progress_certificates',
    'progress_snapshots',
    'schedule_tasks',
    'subcontract_payments',
    'subcontracts',
    'work_item_proformas',
    'work_items',
    'works',
    'purchase_invoices',
    'purchase_order_items',
    'purchase_orders',
    'purchase_request_items',
    'purchase_requests',
    'price_histories',
    'product_price_history',
    'supplier_products',
    'catalog_rubros',
    'rubro_categories',
    'contract_addendums',
    'contracts',
    'proforma_items',
    'proformas',
    'project_liquidations',
    'projects',
    'clients',
    'products',
    'suppliers',
    'refresh_tokens',
    'users',
    'companies',
    'roles',
  ];

  let ok = 0;
  for (const table of tables) {
    try {
      await sequelize.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`, { type: QueryTypes.RAW });
      process.stdout.write(`   ✓ ${table}\n`);
      ok++;
    } catch (e) {
      process.stdout.write(`   ✗ ${table} (${e.message.split('\n')[0]})\n`);
    }
  }

  // Re-habilitar FK checks
  await sequelize.query('SET session_replication_role = DEFAULT;');

  console.log(`\n✅ Reset completado — ${ok}/${tables.length} tablas vaciadas`);
  console.log('   Ejecuta ahora: node src/config/seed.js\n');

  await sequelize.close();
  process.exit(0);
};

reset().catch(err => {
  console.error('❌ Error en reset:', err.message);
  process.exit(1);
});
