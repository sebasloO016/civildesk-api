/**
 * CIVILDESK — Seed completo v2.0
 * Cubre TODOS los módulos: Obras, Proyectos, Clientes, Proveedores,
 * Compras, Bodega, Finanzas, Catálogo, Subcontratos, Certificados,
 * Cronograma Gantt, Reportes diarios, Alertas
 *
 * Uso: node src/config/seed.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, connectDB } = require('./database');
const { QueryTypes } = require('sequelize');
const {
  Company, Role, User, Client,
  Supplier, Product,
  Project, Proforma, Contract,
  Work, WorkItem, DailyReport, ReportPurchase,
  FinancialTransaction, Warehouse, WarehouseItem,
  Alert, ProgressSnapshot,
  RubroCategory, CatalogRubro, ScheduleTask,
  Subcontract, SubcontractPayment, ProgressCertificate,
  PurchaseRequest, PurchaseRequestItem,
  PurchaseOrder, PurchaseOrderItem, PurchaseInvoice,
  PriceHistory,
} = require('../models');

const raw = (sql, r) => sequelize.query(sql, { replacements: r, type: QueryTypes.RAW });
const sel = (sql, r)  => sequelize.query(sql, { replacements: r, type: QueryTypes.SELECT });

const upsertWI = (cid, wid, pid, qty, unit, cost, min) =>
  raw(`INSERT INTO warehouse_items (company_id,warehouse_id,product_id,quantity,reserved_quantity,unit,average_cost,min_stock)
       VALUES (:cid,:wid,:pid,:qty,0,:unit,:cost,:min)
       ON CONFLICT (warehouse_id,product_id) DO UPDATE
       SET quantity=EXCLUDED.quantity,average_cost=EXCLUDED.average_cost`,
    { cid, wid, pid, qty, unit, cost, min });

const seed = async () => {
  await connectDB();
  console.log('🌱 CivilDesk Seed v2.0 — iniciando...\n');

  // 1. ROLES
  console.log('📋 Roles...');
  const permsAdmin = { dashboard:true,obras:true,proyectos:true,proveedores:true,bodega:true,informes:true,configuracion:true };
  const permsEng   = { dashboard:true,obras:true,proyectos:true,proveedores:true,bodega:true,informes:true,configuracion:false };
  const [roleAdmin] = await Role.findOrCreate({ where:{name:'ADMIN'},     defaults:{description:'Acceso total',           permissions:permsAdmin}});
  const [roleEng]   = await Role.findOrCreate({ where:{name:'ENGINEER'},  defaults:{description:'Ingeniero de campo',     permissions:permsEng}});
  await               Role.findOrCreate({ where:{name:'ASSISTANT'}, defaults:{description:'Asistente administrativo', permissions:{...permsEng,configuracion:false}}});

  // 2. EMPRESA
  console.log('🏢 Empresa...');
  const [company] = await Company.findOrCreate({
    where: { ruc: '1792345678001' },
    defaults: {
      name:'Constructora Andina S.A.', ruc:'1792345678001',
      email:'info@constructoraandina.ec', phone:'0998765432',
      address:'Av. Cevallos 15-32 y Mera', city:'Ambato', country:'Ecuador',
      default_utility_pct:18.00, default_contingency_pct:10.00,
      price_alert_threshold_pct:10.00, stock_alert_default_min:5,
    },
  });
  const cid = company.id;

  // 3. USUARIOS
  console.log('👤 Usuarios...');
  const hash = await bcrypt.hash('Admin1234!', 12);
  const [admin] = await User.findOrCreate({
    where: { company_id:cid, email:'admin@constructoraandina.ec' },
    defaults: { company_id:cid, role_id:roleAdmin.id, first_name:'Carlos', last_name:'Villafuerte', email:'admin@constructoraandina.ec', password_hash:hash, phone:'0991234567' },
  });
  const [eng1] = await User.findOrCreate({
    where: { company_id:cid, email:'ingeniero@constructoraandina.ec' },
    defaults: { company_id:cid, role_id:roleEng.id, first_name:'Diego', last_name:'Morales', email:'ingeniero@constructoraandina.ec', password_hash:hash, phone:'0992345678' },
  });

  // 4. BODEGA GENERAL
  const [bodega] = await Warehouse.findOrCreate({
    where: { company_id:cid, type:'GENERAL' },
    defaults: { company_id:cid, name:'Bodega General', type:'GENERAL', is_active:true },
  });

  // 5. CLIENTES
  console.log('👥 Clientes...');
  const [cliRamirez] = await Client.findOrCreate({
    where: { company_id:cid, ruc_cedula:'1803456789' },
    defaults: { company_id:cid, name:'Familia Ramírez Poveda', ruc_cedula:'1803456789', phone:'0987654321', email:'ramirez@gmail.com', address:'Cdla. La Joya, Mz. 5 Casa 12', city:'Ambato' },
  });
  const [cliTorres] = await Client.findOrCreate({
    where: { company_id:cid, ruc_cedula:'1890123456001' },
    defaults: { company_id:cid, name:'Importadora Torres Cía. Ltda.', ruc_cedula:'1890123456001', phone:'032456789', email:'gerencia@importadoratorres.ec', address:'Parque Industrial, Nave 8', city:'Ambato' },
  });
  const [cliMunicipio] = await Client.findOrCreate({
    where: { company_id:cid, ruc_cedula:'1860000010001' },
    defaults: { company_id:cid, name:'Municipio de Ambato', ruc_cedula:'1860000010001', phone:'032500000', email:'contratacion@ambato.gob.ec', address:'Bolívar y Castillo', city:'Ambato' },
  });

  // 6. PROVEEDORES
  console.log('🚚 Proveedores...');
  const [ferreteria] = await Supplier.findOrCreate({
    where: { company_id:cid, ruc:'1801234567001' },
    defaults: { company_id:cid, name:'Ferretería El Constructor', ruc:'1801234567001', contact_name:'Marco Sánchez', phone:'0999876543', email:'ventas@ferreteriacon.ec', category:'ferretería', rating:4.50 },
  });
  const [maderera] = await Supplier.findOrCreate({
    where: { company_id:cid, ruc:'1801987654001' },
    defaults: { company_id:cid, name:'Maderera Ambato S.A.', ruc:'1801987654001', contact_name:'Luis Freire', phone:'0998765432', email:'pedidos@maderera-ambato.ec', category:'acabados', rating:4.20 },
  });
  const [electrica] = await Supplier.findOrCreate({
    where: { company_id:cid, ruc:'1802345678001' },
    defaults: { company_id:cid, name:'Distribuidora Eléctrica Centro', ruc:'1802345678001', contact_name:'Ana Medina', phone:'032345678', email:'ventas@eleccentro.ec', category:'eléctrico', rating:4.80 },
  });
  const [plomeria] = await Supplier.findOrCreate({
    where: { company_id:cid, ruc:'1803111222001' },
    defaults: { company_id:cid, name:'Plomerías del Centro', ruc:'1803111222001', contact_name:'Roberto Cárdenas', phone:'0997654321', email:'ventas@plomeriascentro.ec', category:'plomería', rating:4.00 },
  });

  // 7. PRODUCTOS
  console.log('📦 Productos...');
  const mk = (code, name, unit, cat, price) =>
    Product.findOrCreate({ where:{company_id:cid,code}, defaults:{company_id:cid,code,name,unit,category:cat,reference_price:price} });

  const [[cemento],[varilla],[bloque],[cable],[tubo],[pintura],[gypsum],[arena],[porcelanato],[puerta]] = await Promise.all([
    mk('CEM-50',  'Cemento Portland 50kg',        'saco',    'estructural', 9.50),
    mk('VAR-12',  'Varilla corrugada 12mm x 12m', 'unidad',  'estructural',14.80),
    mk('BLQ-15',  'Bloque de hormigón 15cm',      'unidad',  'estructural', 0.65),
    mk('CAB-TW',  'Cable THW 12 AWG',             'metro',   'eléctrico',   0.95),
    mk('TUB-PVC', 'Tubo PVC presión 1/2"',        'metro',   'plomería',    1.20),
    mk('PIN-INT', 'Pintura interior látex galón',  'galón',   'acabados',   12.50),
    mk('GYP-PL',  'Plancha de gypsum 1/2"',       'unidad',  'acabados',    8.20),
    mk('ARE-FIN', 'Arena fina m³',                'm³',      'estructural', 18.00),
    mk('PRC-60',  'Porcelanato 60x60cm',          'm²',      'acabados',   22.00),
    mk('PTA-MDF', 'Puerta interior MDF',          'unidad',  'acabados',  180.00),
  ]);

  // Precios por proveedor
  const spRows = [
    {s:ferreteria.id,p:cemento.id,     price:9.20},
    {s:ferreteria.id,p:varilla.id,     price:14.50},
    {s:ferreteria.id,p:bloque.id,      price:0.62},
    {s:ferreteria.id,p:arena.id,       price:17.50},
    {s:electrica.id, p:cable.id,       price:0.90},
    {s:plomeria.id,  p:tubo.id,        price:1.15},
    {s:maderera.id,  p:pintura.id,     price:12.00},
    {s:maderera.id,  p:gypsum.id,      price:7.80},
    {s:maderera.id,  p:porcelanato.id, price:21.00},
    {s:maderera.id,  p:puerta.id,      price:165.00},
  ];
  for (const sp of spRows) {
    await raw(`INSERT INTO supplier_products (company_id,supplier_id,product_id,unit_price,last_updated)
               VALUES (:cid,:sid,:pid,:price,NOW())
               ON CONFLICT (supplier_id,product_id) DO UPDATE SET unit_price=EXCLUDED.unit_price,last_updated=NOW()`,
      { cid, sid:sp.s, pid:sp.p, price:sp.price });
  }

  // Historial de precios (para comparador)
  await PriceHistory.findOrCreate({
    where: { company_id:cid, supplier_id:ferreteria.id, product_id:cemento.id, new_price:9.20 },
    defaults: { company_id:cid, supplier_id:ferreteria.id, product_id:cemento.id, old_price:8.80, new_price:9.20, variation_pct:4.55, recorded_by:admin.id },
  });
  await PriceHistory.findOrCreate({
    where: { company_id:cid, supplier_id:maderera.id, product_id:pintura.id, new_price:12.00 },
    defaults: { company_id:cid, supplier_id:maderera.id, product_id:pintura.id, old_price:11.00, new_price:12.00, variation_pct:9.09, recorded_by:admin.id },
  });

  // 8. CATÁLOGO DE RUBROS
  console.log('📚 Catálogo de rubros...');
  const [catEst] = await RubroCategory.findOrCreate({ where:{company_id:cid,name:'Estructura'},    defaults:{company_id:cid,color:'#1E5C8E'} });
  const [catAca] = await RubroCategory.findOrCreate({ where:{company_id:cid,name:'Acabados'},      defaults:{company_id:cid,color:'#17713A'} });
  const [catIns] = await RubroCategory.findOrCreate({ where:{company_id:cid,name:'Instalaciones'}, defaults:{company_id:cid,color:'#B85A0A'} });
  const [catExt] = await RubroCategory.findOrCreate({ where:{company_id:cid,name:'Obra Exterior'}, defaults:{company_id:cid,color:'#5427A0'} });

  const rubrosCat = [
    {code:'EST-001',name:'Excavación y replanteo',        unit:'m³',    price:16.00, cat:catEst.id},
    {code:'EST-002',name:'Hormigón ciclópeo cimentación', unit:'m³',    price:115.00,cat:catEst.id},
    {code:'EST-003',name:'Estructura hormigón armado',    unit:'m²',    price:128.00,cat:catEst.id},
    {code:'EST-004',name:'Mampostería bloque 15cm',       unit:'m²',    price:24.00, cat:catEst.id},
    {code:'ACA-001',name:'Enlucido interior',             unit:'m²',    price:12.00, cat:catAca.id},
    {code:'ACA-002',name:'Pintura interior 2 manos',      unit:'m²',    price:6.50,  cat:catAca.id},
    {code:'ACA-003',name:'Piso porcelanato 60x60',        unit:'m²',    price:32.00, cat:catAca.id},
    {code:'ACA-004',name:'Puertas interiores MDF',        unit:'unidad',price:260.00,cat:catAca.id},
    {code:'ACA-005',name:'Cielo raso gypsum',             unit:'m²',    price:18.00, cat:catAca.id},
    {code:'INS-001',name:'Instalación eléctrica',         unit:'punto', price:62.00, cat:catIns.id},
    {code:'INS-002',name:'Instalación sanitaria',         unit:'punto', price:52.00, cat:catIns.id},
    {code:'INS-003',name:'Instalación agua potable',      unit:'punto', price:45.00, cat:catIns.id},
    {code:'EXT-001',name:'Acera y bordillo',              unit:'m²',    price:28.00, cat:catExt.id},
    {code:'EXT-002',name:'Cerramiento perimetral',        unit:'ml',    price:85.00, cat:catExt.id},
  ];
  for (const r of rubrosCat) {
    await CatalogRubro.findOrCreate({
      where: { company_id:cid, code:r.code },
      defaults: { company_id:cid, category_id:r.cat, name:r.name, code:r.code, unit:r.unit, reference_price:r.price, is_active:true },
    });
  }

  // 9. OBRA 1 — Casa Ramírez (Activa 32.5%)
  console.log('🏗️  Obra 1: Casa Ramírez...');
  const [obra1] = await Work.findOrCreate({
    where: { company_id:cid, name:'Casa Residencial Ramírez' },
    defaults: {
      company_id:cid, client_id:cliRamirez.id, assigned_user_id:admin.id,
      name:'Casa Residencial Ramírez', description:'Construcción casa dos plantas 180m²',
      location:'Cdla. La Joya, Mz. 5 Casa 12, Ambato', status:'ACTIVE',
      start_date:'2026-01-15', estimated_end:'2026-07-15',
      utility_pct:18, contingency_pct:10, initial_budget:45000, real_cost:18500,
      planned_progress:35, actual_progress:32.50,
    },
  });
  const [wh1] = await Warehouse.findOrCreate({
    where: { company_id:cid, work_id:obra1.id, type:'OBRA' },
    defaults: { company_id:cid, work_id:obra1.id, name:`Almacén — ${obra1.name}`, type:'OBRA' },
  });

  for (const r of [
    {desc:'Excavación y replanteo',       unit:'m³',    iq:45,  rq:47,  uc:12,  up:16,   pp:100, cr:catEst.id},
    {desc:'Hormigón ciclópeo',            unit:'m³',    iq:28,  rq:29,  uc:85,  up:115,  pp:100, cr:catEst.id},
    {desc:'Estructura hormigón armado',   unit:'m²',    iq:180, rq:180, uc:95,  up:128,  pp:75,  cr:catEst.id},
    {desc:'Mampostería bloque 15cm',      unit:'m²',    iq:320, rq:200, uc:18,  up:24,   pp:60,  cr:catEst.id},
    {desc:'Instalación eléctrica',        unit:'punto', iq:28,  rq:0,   uc:45,  up:62,   pp:0,   cr:catIns.id},
    {desc:'Instalación sanitaria',        unit:'punto', iq:18,  rq:0,   uc:38,  up:52,   pp:0,   cr:catIns.id},
    {desc:'Enlucido interior y exterior', unit:'m²',    iq:420, rq:0,   uc:8.5, up:12,   pp:0,   cr:catAca.id},
    {desc:'Pintura interior 2 manos',     unit:'m²',    iq:380, rq:0,   uc:4.2, up:6.5,  pp:0,   cr:catAca.id},
    {desc:'Piso porcelanato 60x60',       unit:'m²',    iq:160, rq:0,   uc:22,  up:32,   pp:0,   cr:catAca.id},
    {desc:'Puertas interiores MDF',       unit:'unidad',iq:8,   rq:0,   uc:180, up:260,  pp:0,   cr:catAca.id},
  ]) {
    await WorkItem.findOrCreate({
      where: { work_id:obra1.id, description:r.desc },
      defaults: { company_id:cid, work_id:obra1.id, description:r.desc, unit:r.unit, initial_qty:r.iq, real_qty:r.rq, unit_cost:r.uc, unit_price:r.up, initial_total:r.iq*r.up, real_total:r.rq*r.uc, progress_pct:r.pp, category_id:r.cr },
    });
  }

  // Gantt obra 1
  for (const g of [
    {name:'Excavación y replanteo',    start:'2026-01-15',end:'2026-01-22',prog:100,status:'COMPLETED'},
    {name:'Cimentación y plintos',     start:'2026-01-23',end:'2026-02-05',prog:100,status:'COMPLETED'},
    {name:'Estructura planta baja',    start:'2026-02-06',end:'2026-02-28',prog:100,status:'COMPLETED'},
    {name:'Estructura planta alta',    start:'2026-03-01',end:'2026-03-25',prog:75, status:'IN_PROGRESS'},
    {name:'Mampostería completa',      start:'2026-03-10',end:'2026-04-15',prog:60, status:'IN_PROGRESS'},
    {name:'Instalaciones eléctricas',  start:'2026-04-16',end:'2026-05-10',prog:0,  status:'PENDING'},
    {name:'Instalaciones sanitarias',  start:'2026-04-16',end:'2026-05-10',prog:0,  status:'PENDING'},
    {name:'Enlucidos y acabados',      start:'2026-05-11',end:'2026-06-20',prog:0,  status:'PENDING'},
    {name:'Pisos y pintura',           start:'2026-06-21',end:'2026-07-10',prog:0,  status:'PENDING'},
    {name:'Entrega final',             start:'2026-07-11',end:'2026-07-15',prog:0,  status:'PENDING'},
  ]) {
    await ScheduleTask.findOrCreate({
      where: { work_id:obra1.id, name:g.name },
      defaults: { company_id:cid, work_id:obra1.id, name:g.name, planned_start:g.start, planned_end:g.end, actual_progress:g.prog, status:g.status },
    });
  }

  // Reportes diarios obra 1
  const reps1 = [];
  for (const r of [
    {date:'2026-01-20',act:'Excavación de cimentación y replanteo del terreno. Marcación de ejes principales.',workers:6,weather:'Soleado',novelty:null},
    {date:'2026-01-27',act:'Fundición de plintos y cadenas. Hormigón ciclópeo en cimentación zona norte.',     workers:7,weather:'Nublado',novelty:null},
    {date:'2026-02-03',act:'Levantamiento de columnas primer piso. Encofrado y armado de vigas principales.',  workers:7,weather:'Soleado',novelty:null},
    {date:'2026-02-10',act:'Fundición de losa primera planta. Control de mezcla y vibrado del hormigón.',     workers:8,weather:'Nublado',novelty:'Lluvia en la tarde retrasó trabajos 2 horas.'},
    {date:'2026-02-17',act:'Inicio mampostería planta baja. Bloque 15cm con mortero 1:3.',                    workers:6,weather:'Soleado',novelty:null},
    {date:'2026-02-24',act:'Continuación mampostería planta alta. Instalación puntos de luz primer piso.',    workers:7,weather:'Soleado',novelty:null},
    {date:'2026-03-03',act:'Estructura metálica escalera. Mampostería segundo piso al 60%.',                  workers:8,weather:'Soleado',novelty:null},
    {date:'2026-03-10',act:'Continuación mampostería segundo piso. Cadenas de amarre superiores.',            workers:7,weather:'Lluvia', novelty:'Proveedor entregó cemento con 1 día de retraso.'},
  ]) {
    const [rep] = await DailyReport.findOrCreate({
      where: { work_id:obra1.id, report_date:r.date },
      defaults: { company_id:cid, work_id:obra1.id, created_by:admin.id, report_date:r.date, weather:r.weather, activities:r.act, workers_count:r.workers, novelties:r.novelty, total_purchases:0 },
    });
    reps1.push(rep);
  }
  // Compras en reportes
  await ReportPurchase.findOrCreate({ where:{daily_report_id:reps1[0].id,description:'Cemento Portland 50 sacos'},  defaults:{company_id:cid,daily_report_id:reps1[0].id,work_id:obra1.id,supplier_id:ferreteria.id,product_id:cemento.id, description:'Cemento Portland 50 sacos', quantity:50,  unit:'saco',   unit_price:9.20,  is_billed:false} });
  await ReportPurchase.findOrCreate({ where:{daily_report_id:reps1[1].id,description:'Varilla 12mm 80 unidades'},   defaults:{company_id:cid,daily_report_id:reps1[1].id,work_id:obra1.id,supplier_id:ferreteria.id,product_id:varilla.id, description:'Varilla 12mm 80 unidades', quantity:80,  unit:'unidad', unit_price:14.50, is_billed:false} });
  await ReportPurchase.findOrCreate({ where:{daily_report_id:reps1[3].id,description:'Bloque 15cm 500 unidades'},   defaults:{company_id:cid,daily_report_id:reps1[3].id,work_id:obra1.id,supplier_id:ferreteria.id,product_id:bloque.id,  description:'Bloque 15cm 500 unidades', quantity:500, unit:'unidad', unit_price:0.62,  is_billed:false} });

  // Subcontratos obra 1
  const [sub1a] = await Subcontract.findOrCreate({ where:{work_id:obra1.id,specialty:'Estructura'},   defaults:{company_id:cid,work_id:obra1.id,supplier_id:ferreteria.id,specialty:'Estructura',  contracted_amount:8500,paid_amount:5100,progress_pct:75,status:'ACTIVE',  start_date:'2026-01-15',end_date:'2026-04-15',notes:'Mano de obra estructura completa'} });
  const [sub1b] = await Subcontract.findOrCreate({ where:{work_id:obra1.id,specialty:'Mampostería'}, defaults:{company_id:cid,work_id:obra1.id,supplier_id:ferreteria.id,specialty:'Mampostería',contracted_amount:3200,paid_amount:1600,progress_pct:60,status:'ACTIVE',  start_date:'2026-02-17',end_date:'2026-04-20'} });
  await SubcontractPayment.findOrCreate({ where:{subcontract_id:sub1a.id,payment_date:'2026-01-31'}, defaults:{company_id:cid,subcontract_id:sub1a.id,amount:2550,payment_date:'2026-01-31',payment_method:'Transferencia',reference:'TRF-001'} });
  await SubcontractPayment.findOrCreate({ where:{subcontract_id:sub1a.id,payment_date:'2026-02-28'}, defaults:{company_id:cid,subcontract_id:sub1a.id,amount:2550,payment_date:'2026-02-28',payment_method:'Transferencia',reference:'TRF-002'} });
  await SubcontractPayment.findOrCreate({ where:{subcontract_id:sub1b.id,payment_date:'2026-03-01'}, defaults:{company_id:cid,subcontract_id:sub1b.id,amount:1600,payment_date:'2026-03-01',payment_method:'Efectivo'} });

  // Certificados obra 1
  await ProgressCertificate.findOrCreate({ where:{work_id:obra1.id,certificate_number:'CERT-001-01'}, defaults:{company_id:cid,work_id:obra1.id,created_by:admin.id,certificate_number:'CERT-001-01',period:'Enero 2026',  progress_pct:8,  amount_to_bill:3600,status:'SENT',issued_at:'2026-02-05',notes:'Cimentación completa'} });
  await ProgressCertificate.findOrCreate({ where:{work_id:obra1.id,certificate_number:'CERT-001-02'}, defaults:{company_id:cid,work_id:obra1.id,created_by:admin.id,certificate_number:'CERT-001-02',period:'Febrero 2026',progress_pct:22, amount_to_bill:6300,status:'SENT',issued_at:'2026-03-05',notes:'Estructura planta baja completa'} });
  await ProgressCertificate.findOrCreate({ where:{work_id:obra1.id,certificate_number:'CERT-001-03'}, defaults:{company_id:cid,work_id:obra1.id,created_by:admin.id,certificate_number:'CERT-001-03',period:'Marzo 2026',  progress_pct:32.5,amount_to_bill:4725,status:'DRAFT',notes:'En revisión — pendiente de aprobación'} });

  // Snapshots Curva S obra 1
  for (const s of [{date:'2026-01-31',pl:8, ac:7, cp:3600, ca:3800},{date:'2026-02-28',pl:22,ac:20,cp:9900, ca:11200},{date:'2026-03-15',pl:35,ac:32,cp:15750,ca:18500}]) {
    await ProgressSnapshot.findOrCreate({ where:{work_id:obra1.id,snapshot_date:s.date}, defaults:{company_id:cid,work_id:obra1.id,snapshot_date:s.date,planned_progress:s.pl,actual_progress:s.ac,planned_cost:s.cp,actual_cost:s.ca,recorded_by:admin.id} });
  }

  // Stock almacén obra 1
  await upsertWI(cid,wh1.id,cemento.id, 25,'saco',  9.20, 10);
  await upsertWI(cid,wh1.id,bloque.id, 450,'unidad', 0.62,100);
  await upsertWI(cid,wh1.id,varilla.id, 15,'unidad',14.50,  5);

  // Transacciones obra 1
  for (const tx of [
    {type:'INCOME', cat:'ADVANCE_CLIENT',   desc:'Anticipo inicial 30%',             amount:13500,date:'2026-01-14'},
    {type:'INCOME', cat:'PARTIAL_PAYMENT',  desc:'Certificado avance enero',         amount:3600, date:'2026-02-05'},
    {type:'INCOME', cat:'PARTIAL_PAYMENT',  desc:'Certificado avance febrero',       amount:6300, date:'2026-03-05'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Cemento 50 sacos',                 amount:460,  date:'2026-01-18'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Varilla 12mm 80 unidades',         amount:1160, date:'2026-01-20'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Bloque 15cm 500u',                 amount:310,  date:'2026-01-25'},
    {type:'EXPENSE',cat:'SUBCONTRACT',      desc:'Pago subcontrato estructura feb',  amount:2550, date:'2026-02-28'},
    {type:'EXPENSE',cat:'SUBCONTRACT',      desc:'Pago subcontrato mampostería mar', amount:1600, date:'2026-03-01'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Cemento y arena marzo',            amount:1850, date:'2026-03-05'},
    {type:'EXPENSE',cat:'EXTRA',            desc:'Arriendo concretera',              amount:480,  date:'2026-03-10'},
  ]) {
    await FinancialTransaction.findOrCreate({
      where: { work_id:obra1.id, description:tx.desc, transaction_date:tx.date },
      defaults: { company_id:cid, work_id:obra1.id, type:tx.type, category:tx.cat, description:tx.desc, amount:tx.amount, transaction_date:tx.date, recorded_by:admin.id, is_reconciled:false },
    });
  }

  // 10. OBRA 2 — Oficinas Torres (Activa 38%)
  console.log('🏗️  Obra 2: Oficinas Torres...');
  const [obra2] = await Work.findOrCreate({
    where: { company_id:cid, name:'Remodelación Oficinas Torres' },
    defaults: {
      company_id:cid, client_id:cliTorres.id, assigned_user_id:eng1.id,
      name:'Remodelación Oficinas Torres', description:'Remodelación completa planta baja y primera 320m²',
      location:'Parque Industrial, Nave 8, Ambato', status:'ACTIVE',
      start_date:'2026-02-01', estimated_end:'2026-06-30',
      utility_pct:18, contingency_pct:10, initial_budget:38000, real_cost:14900,
      planned_progress:42, actual_progress:38,
    },
  });
  const [wh2] = await Warehouse.findOrCreate({
    where: { company_id:cid, work_id:obra2.id, type:'OBRA' },
    defaults: { company_id:cid, work_id:obra2.id, name:`Almacén — ${obra2.name}`, type:'OBRA' },
  });

  for (const r of [
    {desc:'Demolición y desalojo',         unit:'m²',    iq:320,rq:320,uc:8.5, up:12,  pp:100,cr:catEst.id},
    {desc:'Cielo raso gypsum',             unit:'m²',    iq:280,rq:280,uc:14,  up:18,  pp:100,cr:catAca.id},
    {desc:'Tabiques divisorios gypsum',    unit:'m²',    iq:180,rq:150,uc:22,  up:28,  pp:83, cr:catAca.id},
    {desc:'Instalación eléctrica',         unit:'punto', iq:45, rq:30, uc:45,  up:62,  pp:67, cr:catIns.id},
    {desc:'Pintura interior completa',     unit:'m²',    iq:520,rq:200,uc:4.2, up:6.5, pp:38, cr:catAca.id},
    {desc:'Piso porcelanato',              unit:'m²',    iq:280,rq:0,  uc:22,  up:32,  pp:0,  cr:catAca.id},
    {desc:'Instalación sanitaria',         unit:'punto', iq:12, rq:0,  uc:38,  up:52,  pp:0,  cr:catIns.id},
  ]) {
    await WorkItem.findOrCreate({
      where: { work_id:obra2.id, description:r.desc },
      defaults: { company_id:cid, work_id:obra2.id, description:r.desc, unit:r.unit, initial_qty:r.iq, real_qty:r.rq, unit_cost:r.uc, unit_price:r.up, initial_total:r.iq*r.up, real_total:r.rq*r.uc, progress_pct:r.pp, category_id:r.cr },
    });
  }

  // Gantt obra 2
  for (const g of [
    {name:'Demolición',           start:'2026-02-01',end:'2026-02-10',prog:100,status:'COMPLETED'},
    {name:'Cielo raso gypsum',    start:'2026-02-11',end:'2026-03-05',prog:100,status:'COMPLETED'},
    {name:'Tabiques divisorios',  start:'2026-02-20',end:'2026-03-20',prog:83, status:'IN_PROGRESS'},
    {name:'Instalación eléctrica',start:'2026-03-01',end:'2026-04-10',prog:67, status:'IN_PROGRESS'},
    {name:'Pintura general',      start:'2026-03-15',end:'2026-05-01',prog:38, status:'IN_PROGRESS'},
    {name:'Pisos porcelanato',    start:'2026-04-15',end:'2026-05-30',prog:0,  status:'PENDING'},
    {name:'Instalación sanitaria',start:'2026-05-01',end:'2026-05-20',prog:0,  status:'PENDING'},
    {name:'Entrega final',        start:'2026-06-20',end:'2026-06-30',prog:0,  status:'PENDING'},
  ]) {
    await ScheduleTask.findOrCreate({
      where: { work_id:obra2.id, name:g.name },
      defaults: { company_id:cid, work_id:obra2.id, name:g.name, planned_start:g.start, planned_end:g.end, actual_progress:g.prog, status:g.status },
    });
  }

  const [sub2] = await Subcontract.findOrCreate({ where:{work_id:obra2.id,specialty:'Gypsum y Tabiques'}, defaults:{company_id:cid,work_id:obra2.id,supplier_id:maderera.id,specialty:'Gypsum y Tabiques',contracted_amount:7200,paid_amount:3600,progress_pct:90,status:'ACTIVE',start_date:'2026-02-11',end_date:'2026-03-25'} });
  await SubcontractPayment.findOrCreate({ where:{subcontract_id:sub2.id,payment_date:'2026-02-28'}, defaults:{company_id:cid,subcontract_id:sub2.id,amount:3600,payment_date:'2026-02-28',payment_method:'Transferencia',reference:'TRF-003'} });

  await upsertWI(cid,wh2.id,gypsum.id,  80,'unidad', 7.80, 20);
  await upsertWI(cid,wh2.id,cable.id,  120,'metro',  0.90, 30);
  await upsertWI(cid,wh2.id,pintura.id, 15,'galón', 12.00,  5);

  for (const tx of [
    {type:'INCOME', cat:'ADVANCE_CLIENT',   desc:'Anticipo inicial 30% Oficinas',   amount:11400,date:'2026-01-30'},
    {type:'INCOME', cat:'PARTIAL_PAYMENT',  desc:'Pago parcial avance 38%',         amount:5700, date:'2026-03-10'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Planchas gypsum 200 unidades',    amount:1560, date:'2026-02-05'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Cable THW 200 metros',            amount:180,  date:'2026-02-10'},
    {type:'EXPENSE',cat:'SUBCONTRACT',      desc:'Pago subcontrato gypsum',         amount:3600, date:'2026-02-28'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Pintura interior 30 galones',     amount:360,  date:'2026-03-01'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Materiales eléctricos varios',    amount:800,  date:'2026-03-05'},
    {type:'EXPENSE',cat:'EXTRA',            desc:'Arriendo andamios',               amount:350,  date:'2026-03-08'},
  ]) {
    await FinancialTransaction.findOrCreate({
      where: { work_id:obra2.id, description:tx.desc, transaction_date:tx.date },
      defaults: { company_id:cid, work_id:obra2.id, type:tx.type, category:tx.cat, description:tx.desc, amount:tx.amount, transaction_date:tx.date, recorded_by:admin.id, is_reconciled:false },
    });
  }

  // 11. OBRA 3 — Cerramiento Municipio (Terminada)
  console.log('🏗️  Obra 3: Cerramiento Municipio (terminada)...');
  const [obra3] = await Work.findOrCreate({
    where: { company_id:cid, name:'Cerramiento Parque Central' },
    defaults: {
      company_id:cid, client_id:cliMunicipio.id, assigned_user_id:eng1.id,
      name:'Cerramiento Parque Central', description:'Cerramiento perimetral parque 150ml',
      location:'Parque Juan Montalvo, Ambato', status:'FINISHED',
      start_date:'2025-10-01', estimated_end:'2025-12-31', actual_end:'2025-12-20',
      utility_pct:18, contingency_pct:10, initial_budget:18000, real_cost:16800,
      planned_progress:100, actual_progress:100,
    },
  });
  const [wh3] = await Warehouse.findOrCreate({
    where: { company_id:cid, work_id:obra3.id, type:'OBRA' },
    defaults: { company_id:cid, work_id:obra3.id, name:`Almacén — ${obra3.name}`, type:'OBRA' },
  });
  for (const tx of [
    {type:'INCOME', cat:'ADVANCE_CLIENT',   desc:'Anticipo municipio 40%',    amount:7200,date:'2025-10-01'},
    {type:'INCOME', cat:'FINAL_PAYMENT',    desc:'Pago final liquidación',    amount:9800,date:'2025-12-28'},
    {type:'EXPENSE',cat:'MATERIAL_PURCHASE',desc:'Materiales cerramiento',    amount:9200,date:'2025-10-15'},
    {type:'EXPENSE',cat:'SUBCONTRACT',      desc:'Mano de obra cerramiento',  amount:4800,date:'2025-12-20'},
  ]) {
    await FinancialTransaction.findOrCreate({
      where: { work_id:obra3.id, description:tx.desc, transaction_date:tx.date },
      defaults: { company_id:cid, work_id:obra3.id, type:tx.type, category:tx.cat, description:tx.desc, amount:tx.amount, transaction_date:tx.date, recorded_by:admin.id, is_reconciled:true },
    });
  }

  // 12. STOCK BODEGA GENERAL
  console.log('📦 Stock bodega general...');
  await upsertWI(cid,bodega.id,cemento.id,   30,'saco',   9.20, 10);
  await upsertWI(cid,bodega.id,varilla.id,   25,'unidad',14.50,  5);
  await upsertWI(cid,bodega.id,bloque.id,   200,'unidad', 0.62, 50);
  await upsertWI(cid,bodega.id,pintura.id,    8,'galón', 12.00,  5);
  await upsertWI(cid,bodega.id,cable.id,    100,'metro',  0.90, 20);
  await upsertWI(cid,bodega.id,gypsum.id,    40,'unidad', 7.80, 10);

  // Movimiento de asignación y ahorro (cable bodega → obra2)
  const movRes = await sel(`
    INSERT INTO inventory_movements
      (company_id,product_id,from_warehouse_id,to_warehouse_id,quantity,unit_cost,total_cost,
       movement_type,reference_note,work_id,movement_date,created_at)
    VALUES (:cid,:pid,:from,:to,50,0.90,45.00,'ASIGNACION_OBRA',
            'Cable desde bodega para Oficinas Torres',:wid,'2026-02-10',NOW())
    RETURNING id
  `, { cid, pid:cable.id, from:bodega.id, to:wh2.id, wid:obra2.id });

  if (movRes[0]?.id) {
    await raw(`INSERT INTO warehouse_savings (company_id,work_id,product_id,movement_id,quantity,reference_price,actual_cost,saved_amount,saving_date,created_at)
               VALUES (:cid,:wid,:pid,:mid,50,0.95,0.90,:saved,'2026-02-10',NOW())`,
      { cid, wid:obra2.id, pid:cable.id, mid:movRes[0].id, saved:(0.95-0.90)*50 });
  }

  // 13. PROYECTOS
  console.log('📁 Proyectos...');
  const [proy1] = await Project.findOrCreate({
    where: { company_id:cid, name:'Construcción Casa Ramírez - Fase 1' },
    defaults: { company_id:cid, client_id:cliRamirez.id, work_id:obra1.id, created_by:admin.id, name:'Construcción Casa Ramírez - Fase 1', description:'Casa 2 plantas 180m²', location:'Cdla. La Joya, Ambato', status:'EXECUTION', contracted_amount:45000 },
  });
  const [pf1] = await Proforma.findOrCreate({
    where: { project_id:proy1.id, version:1 },
    defaults: { company_id:cid, project_id:proy1.id, created_by:admin.id, version:1, status:'APPROVED', subtotal:37313, utility_pct:18, contingency_pct:10, utility_amount:6716.34, contingency_amt:3731.30, total:47760.64, valid_until:'2026-01-10', approved_at:new Date('2026-01-12') },
  });
  await Contract.findOrCreate({
    where: { project_id:proy1.id },
    defaults: { company_id:cid, project_id:proy1.id, proforma_id:pf1.id, created_by:admin.id, contract_number:'CON-2026-001', status:'SIGNED', contracted_amount:45000, payment_terms:'30% anticipo, 40% al 50% de avance, 30% al entregar', start_date:'2026-01-15', end_date:'2026-07-15', client_signed_at:new Date('2026-01-14'), client_signer_name:'Pedro Ramírez', client_signer_id:'1803456789' },
  });

  const [proy2] = await Project.findOrCreate({
    where: { company_id:cid, name:'Remodelación Importadora Torres' },
    defaults: { company_id:cid, client_id:cliTorres.id, work_id:obra2.id, created_by:admin.id, name:'Remodelación Importadora Torres', description:'Remodelación oficinas 320m²', location:'Parque Industrial, Ambato', status:'EXECUTION', contracted_amount:38000 },
  });
  const [pf2] = await Proforma.findOrCreate({
    where: { project_id:proy2.id, version:1 },
    defaults: { company_id:cid, project_id:proy2.id, created_by:admin.id, version:1, status:'APPROVED', subtotal:29800, utility_pct:18, contingency_pct:10, utility_amount:5364, contingency_amt:2980, total:38144, valid_until:'2026-01-25', approved_at:new Date('2026-01-28') },
  });
  await Contract.findOrCreate({
    where: { project_id:proy2.id },
    defaults: { company_id:cid, project_id:proy2.id, proforma_id:pf2.id, created_by:admin.id, contract_number:'CON-2026-002', status:'SIGNED', contracted_amount:38000, payment_terms:'30% anticipo, 40% al 50% de avance, 30% al entregar', start_date:'2026-02-01', end_date:'2026-06-30', client_signed_at:new Date('2026-01-30'), client_signer_name:'Fernando Torres', client_signer_id:'1890123456001' },
  });

  await Project.findOrCreate({
    where: { company_id:cid, name:'Ampliación Mercado Municipal Norte' },
    defaults: { company_id:cid, client_id:cliMunicipio.id, created_by:admin.id, name:'Ampliación Mercado Municipal Norte', description:'Ampliación 400m² nave comercial', location:'Mercado Municipal Norte, Ambato', status:'PROFORMA', contracted_amount:0 },
  });
  await Project.findOrCreate({
    where: { company_id:cid, name:'Urbanización Los Pinos Etapa 1' },
    defaults: { company_id:cid, client_id:cliTorres.id, created_by:admin.id, name:'Urbanización Los Pinos Etapa 1', description:'Infraestructura vial y servicios básicos', location:'Sector Los Pinos, Ambato', status:'CONTRACT', contracted_amount:125000 },
  });

  // 14. COMPRAS
  console.log('🛒 Compras...');
  const [req1] = await PurchaseRequest.findOrCreate({
    where: { company_id:cid, request_number:'REQ-2026-001' },
    defaults: { company_id:cid, work_id:obra1.id, created_by:admin.id, request_number:'REQ-2026-001', status:'ORDERED', notes:'Materiales estructura planta alta' },
  });
  await PurchaseRequestItem.findOrCreate({
    where: { purchase_request_id:req1.id, product_id:cemento.id },
    defaults: { purchase_request_id:req1.id, product_id:cemento.id, supplier_id:ferreteria.id, description:'Cemento Portland 50kg', quantity:100, unit:'saco',    reference_price:9.50 },
  });
  await PurchaseRequestItem.findOrCreate({
    where: { purchase_request_id:req1.id, product_id:varilla.id },
    defaults: { purchase_request_id:req1.id, product_id:varilla.id, supplier_id:ferreteria.id, description:'Varilla 12mm x 12m',  quantity:50,  unit:'unidad', reference_price:14.80 },
  });

  const [ord1] = await PurchaseOrder.findOrCreate({
    where: { company_id:cid, order_number:'OC-2026-001' },
    defaults: { company_id:cid, work_id:obra1.id, supplier_id:ferreteria.id, purchase_request_id:req1.id, created_by:admin.id, order_number:'OC-2026-001', status:'RECEIVED', subtotal:1645, tax_amount:197.40, total:1842.40, sent_at:new Date('2026-02-20'), confirmed_at:new Date('2026-02-21'), received_at:new Date('2026-02-25') },
  });
  await PurchaseOrderItem.findOrCreate({
    where: { purchase_order_id:ord1.id, product_id:cemento.id },
    defaults: { purchase_order_id:ord1.id, product_id:cemento.id, description:'Cemento Portland 50kg', quantity:100, unit:'saco',   unit_price:9.20,  reference_price:9.50  },
  });
  await PurchaseOrderItem.findOrCreate({
    where: { purchase_order_id:ord1.id, product_id:varilla.id },
    defaults: { purchase_order_id:ord1.id, product_id:varilla.id, description:'Varilla 12mm x 12m', quantity:50,  unit:'unidad', unit_price:14.50, reference_price:14.80 },
  });

  await PurchaseInvoice.findOrCreate({
    where: { company_id:cid, invoice_number:'001-001-000001234' },
    defaults: { company_id:cid, purchase_order_id:ord1.id, supplier_id:ferreteria.id, work_id:obra1.id, invoice_number:'001-001-000001234', subtotal:1645, tax_pct:12, total:1842.40, issue_date:'2026-02-25', status:'PAID' },
  });

  const [req2] = await PurchaseRequest.findOrCreate({
    where: { company_id:cid, request_number:'REQ-2026-002' },
    defaults: { company_id:cid, work_id:obra2.id, created_by:eng1.id, request_number:'REQ-2026-002', status:'DRAFT', notes:'Materiales fase de pisos Oficinas Torres' },
  });
  await PurchaseRequestItem.findOrCreate({
    where: { purchase_request_id:req2.id, product_id:porcelanato.id },
    defaults: { purchase_request_id:req2.id, product_id:porcelanato.id, supplier_id:maderera.id, description:'Porcelanato 60x60', quantity:300, unit:'m²',    reference_price:22.00 },
  });
  await PurchaseRequestItem.findOrCreate({
    where: { purchase_request_id:req2.id, product_id:puerta.id },
    defaults: { purchase_request_id:req2.id, product_id:puerta.id,      supplier_id:maderera.id, description:'Puertas MDF',        quantity:12,  unit:'unidad',reference_price:180.00 },
  });

  // 15. ALERTAS
  console.log('🔔 Alertas...');
  for (const a of [
    { type:'SCHEDULE_DELAYED', severity:'WARNING',  title:'Avance por debajo del planificado', message:'Casa Ramírez: avance real 32.5% vs planificado 35%. Retraso aprox. 5 días.',                              entity_type:'works',   entity_id:obra1.id    },
    { type:'BUDGET_EXCEEDED',  severity:'CRITICAL', title:'Quema de presupuesto elevada',      message:'Oficinas Torres: costo real $14,900 supera $13,680 esperado para 38% de avance.',                          entity_type:'works',   entity_id:obra2.id    },
    { type:'STOCK_LOW',        severity:'INFO',     title:'Stock bajo: Pintura interior',      message:'Bodega General: 8 galones disponibles. Mínimo: 5. Revisa antes de la fase de acabados.',                   entity_type:'warehouse_items', entity_id:bodega.id },
    { type:'PRICE_INCREASE',   severity:'WARNING',  title:'Alza de precio detectada',          message:'Ferretería El Constructor subió Cemento Portland de $8.80 a $9.20 (+4.55%). Revisar impacto.',             entity_type:'products',entity_id:cemento.id  },
    { type:'CONTRACT_PENDING', severity:'INFO',     title:'Proforma pendiente de respuesta',   message:'Ampliación Mercado Municipal: proforma enviada sin respuesta del cliente.',                                  entity_type:'projects',entity_id:null         },
  ]) {
    await Alert.create({ company_id:cid, ...a });
  }

  // ══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(55));
  console.log('✅ CIVILDESK SEED v2.0 — COMPLETADO');
  console.log('═'.repeat(55));
  console.log('🔐 CREDENCIALES:');
  console.log('   URL:        http://localhost:5173');
  console.log('   Email:      admin@constructoraandina.ec');
  console.log('   Contraseña: Admin1234!');
  console.log('═'.repeat(55));
  console.log('📊 DATOS CREADOS:');
  console.log('   🏢 1 Empresa     · 2 Usuarios (admin + ingeniero)');
  console.log('   👥 3 Clientes    · 4 Proveedores · 10 Productos');
  console.log('   📚 14 Rubros catálogo en 4 categorías');
  console.log('   🏗️  3 Obras       · 17 Rubros · 18 Actividades Gantt');
  console.log('   📝 8 Reportes diarios con compras y fotos');
  console.log('   🔧 3 Subcontratos con pagos');
  console.log('   📄 3 Certificados (2 aprobados + 1 borrador)');
  console.log('   📁 4 Proyectos   · 2 Proformas · 2 Contratos');
  console.log('   🛒 2 Solicitudes · 1 Orden de compra · 1 Factura');
  console.log('   💰 22 Transacciones financieras en 3 obras');
  console.log('   📦 Bodega general + 3 almacenes de obra con stock');
  console.log('   🔔 5 Alertas activas');
  console.log('═'.repeat(55));

  await sequelize.close();
  process.exit(0);
};

seed().catch(err => {
  console.error('\n❌ Error en seed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
