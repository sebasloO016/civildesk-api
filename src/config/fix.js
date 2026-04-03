/**
 * CIVILDESK — Fix Script
 * Corrige el hash de contraseña del usuario seed
 * y verifica el estado de la DB
 * 
 * Uso: node src/config/fix.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, connectDB } = require('./database');
const { QueryTypes } = require('sequelize');

const fix = async () => {
  await connectDB();
  console.log('\n🔧 Iniciando correcciones...\n');

  // ── 1. Ver qué usuarios existen ──────────────────────────────
  console.log('👤 Usuarios en la DB:');
  const users = await sequelize.query(
    `SELECT id, company_id, email, is_active, created_at FROM users ORDER BY id`,
    { type: QueryTypes.SELECT }
  );
  console.table(users);

  // ── 2. Ver qué empresas existen ──────────────────────────────
  console.log('\n🏢 Empresas en la DB:');
  const companies = await sequelize.query(
    `SELECT id, name, ruc, email, is_active FROM companies ORDER BY id`,
    { type: QueryTypes.SELECT }
  );
  console.table(companies);

  // ── 3. Resetear contraseña del primer admin ──────────────────
  if (users.length > 0) {
    const newHash = await bcrypt.hash('Admin1234!', 12);
    
    for (const user of users) {
      await sequelize.query(
        `UPDATE users SET password_hash = :hash WHERE id = :id`,
        { replacements: { hash: newHash, id: user.id }, type: QueryTypes.UPDATE }
      );
      console.log(`\n✅ Contraseña actualizada para: ${user.email}`);
      console.log(`   → Nueva contraseña: Admin1234!`);
    }
  }

  // ── 4. Verificar roles ───────────────────────────────────────
  console.log('\n📋 Roles en la DB:');
  const roles = await sequelize.query(
    `SELECT id, name FROM roles`,
    { type: QueryTypes.SELECT }
  );
  console.table(roles);

  // Si no hay roles, crearlos
  if (roles.length === 0) {
    console.log('⚠️  No hay roles — creando roles base...');
    await sequelize.query(`
      INSERT INTO roles (name, description, permissions, created_at)
      VALUES
        ('ADMIN', 'Acceso total', '{"dashboard":true,"obras":true,"proyectos":true,"proveedores":true,"bodega":true,"informes":true,"configuracion":true}', NOW()),
        ('ENGINEER', 'Ingeniero de campo', '{"dashboard":true,"obras":true,"proyectos":true,"proveedores":true,"bodega":true,"informes":true,"configuracion":false}', NOW()),
        ('ASSISTANT', 'Asistente', '{"dashboard":true,"obras":true,"proyectos":false,"proveedores":true,"bodega":true,"informes":true,"configuracion":false}', NOW())
      ON CONFLICT (name) DO NOTHING
    `, { type: QueryTypes.INSERT });
    console.log('✅ Roles creados');
  }

  // ── 5. Si no hay usuarios, crear admin desde cero ────────────
  if (users.length === 0) {
    console.log('\n⚠️  No hay usuarios — creando empresa y admin desde cero...');

    // Crear empresa
    const [compResult] = await sequelize.query(`
      INSERT INTO companies (name, ruc, email, country, default_utility_pct, default_contingency_pct, price_alert_threshold_pct, stock_alert_default_min, is_active, created_at, updated_at)
      VALUES ('Mi Empresa', NULL, 'admin@miempresa.com', 'Ecuador', 18.00, 10.00, 10.00, 5.00, true, NOW(), NOW())
      RETURNING id
    `, { type: QueryTypes.INSERT });

    const company_id = compResult[0]?.id;
    console.log(`✅ Empresa creada con ID: ${company_id}`);

    // Crear bodega general
    await sequelize.query(`
      INSERT INTO warehouses (company_id, name, type, is_active, created_at)
      VALUES (:cid, 'Bodega General', 'GENERAL', true, NOW())
    `, { replacements: { cid: company_id }, type: QueryTypes.INSERT });

    // Obtener rol admin
    const [adminRole] = await sequelize.query(
      `SELECT id FROM roles WHERE name = 'ADMIN' LIMIT 1`,
      { type: QueryTypes.SELECT }
    );

    const hash = await bcrypt.hash('Admin1234!', 12);

    await sequelize.query(`
      INSERT INTO users (company_id, role_id, first_name, last_name, email, password_hash, is_active, created_at, updated_at)
      VALUES (:cid, :rid, 'Admin', 'CivilDesk', 'admin@miempresa.com', :hash, true, NOW(), NOW())
    `, {
      replacements: { cid: company_id, rid: adminRole.id, hash },
      type: QueryTypes.INSERT
    });

    console.log('\n✅ Usuario admin creado:');
    console.log('   Email:      admin@miempresa.com');
    console.log('   Contraseña: Admin1234!');
  }

  // ── 6. Verificar constraint de companies ─────────────────────
  console.log('\n🔍 Verificando constraints de la tabla companies...');
  const constraints = await sequelize.query(`
    SELECT constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_name = 'companies'
    ORDER BY constraint_type
  `, { type: QueryTypes.SELECT });
  console.table(constraints);

  // ── 7. Probar bcrypt ─────────────────────────────────────────
  console.log('\n🔐 Verificando bcrypt...');
  const testHash = await bcrypt.hash('Admin1234!', 12);
  const testOk   = await bcrypt.compare('Admin1234!', testHash);
  console.log(`   bcrypt funciona: ${testOk ? '✅ SÍ' : '❌ NO'}`);

  // ── Resumen ──────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(50));
  console.log('CREDENCIALES ACTIVAS:');
  const finalUsers = await sequelize.query(
    `SELECT u.email, c.name as empresa FROM users u JOIN companies c ON c.id = u.company_id`,
    { type: QueryTypes.SELECT }
  );
  finalUsers.forEach(u => {
    console.log(`   Email:      ${u.email}`);
    console.log(`   Empresa:    ${u.empresa}`);
    console.log(`   Contraseña: Admin1234!`);
  });
  console.log('═'.repeat(50));

  await sequelize.close();
  process.exit(0);
};

fix().catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err);
  process.exit(1);
});
