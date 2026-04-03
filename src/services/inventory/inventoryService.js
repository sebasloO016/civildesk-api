const { sequelize }        = require('../../config/database');
const { QueryTypes }       = require('sequelize');
const {
  Warehouse, WarehouseItem, InventoryMovement,
  WarehouseSaving, Product, Work,
} = require('../../models');
const { createError }      = require('../../middlewares/errorHandler');

// ── Registrar movimiento + actualizar stock (llama función PG) ─
const registerMovement = async ({
  company_id, product_id,
  from_warehouse_id, to_warehouse_id,
  quantity, unit_cost,
  movement_type, reference_note,
  work_id, created_by,
  origin_work_id = null,
  daily_report_id = null,
  purchase_invoice_id = null,
}, transaction = null) => {

  const [rows] = await sequelize.query(
    `SELECT register_inventory_movement(
       :company_id, :product_id,
       :from_wh, :to_wh,
       :qty, :cost,
       :type, :note,
       :work_id, :user_id,
       :origin_work_id
     ) AS movement_id`,
    {
      replacements: {
        company_id, product_id,
        from_wh:      from_warehouse_id || null,
        to_wh:        to_warehouse_id   || null,
        qty:          quantity,
        cost:         unit_cost || 0,
        type:         movement_type,
        note:         reference_note || null,
        work_id:      work_id || null,
        user_id:      created_by || null,
        origin_work_id: origin_work_id || null,
      },
      type:        QueryTypes.SELECT,
      transaction,
    }
  );

  // Actualizar referencias adicionales si vienen
  if (rows?.movement_id && (daily_report_id || purchase_invoice_id)) {
    await InventoryMovement.update(
      { daily_report_id, purchase_invoice_id },
      { where: { id: rows.movement_id }, transaction }
    );
  }

  return rows?.movement_id;
};

// ── Reservar stock en bodega ──────────────────────────────────
const reserveStock = async ({ warehouse_id, product_id, quantity, work_id, company_id, created_by }) => {
  const t = await sequelize.transaction();
  try {
    await sequelize.query(
      `SELECT reserve_warehouse_stock(:wh_id, :prod_id, :qty, :work_id, :co_id, :user_id)`,
      {
        replacements: {
          wh_id: warehouse_id, prod_id: product_id,
          qty: quantity, work_id, co_id: company_id, user_id: created_by,
        },
        type: QueryTypes.SELECT,
        transaction: t,
      }
    );
    await t.commit();
    return true;
  } catch (err) {
    await t.rollback();
    throw createError(err.message, 400);
  }
};

// ── Consumir material desde reporte diario ────────────────────
const consumeFromReport = async ({ daily_report_id, product_id, quantity, work_id, company_id, created_by }) => {
  const [rows] = await sequelize.query(
    `SELECT consume_material_from_report(:report_id, :prod_id, :qty, :work_id, :co_id, :user_id) AS movement_id`,
    {
      replacements: {
        report_id: daily_report_id, prod_id: product_id,
        qty: quantity, work_id, co_id: company_id, user_id: created_by,
      },
      type: QueryTypes.SELECT,
    }
  );
  return rows?.movement_id;
};

// ── Trasladar sobrantes al finalizar obra ─────────────────────
const transferSurplusToGeneral = async ({ work_id, company_id, items, created_by }) => {
  const t = await sequelize.transaction();
  try {
    // Obtener almacen de obra y bodega general
    const [workWarehouse, generalWarehouse] = await Promise.all([
      Warehouse.findOne({ where: { work_id, type: 'OBRA', company_id }, transaction: t }),
      Warehouse.findOne({ where: { type: 'GENERAL', company_id }, transaction: t }),
    ]);

    if (!workWarehouse)    throw createError('Almacén de obra no encontrado', 404);
    if (!generalWarehouse) throw createError('Bodega general no encontrada', 404);

    const results = [];
    for (const item of items) {
      const { product_id, quantity } = item;

      // Verificar stock disponible en obra
      const stockItem = await WarehouseItem.findOne({
        where: { warehouse_id: workWarehouse.id, product_id },
        transaction: t,
      });

      if (!stockItem || stockItem.getAvailable() < quantity) {
        throw createError(`Stock insuficiente para producto ID ${product_id}`, 400);
      }

      const movId = await registerMovement({
        company_id,
        product_id,
        from_warehouse_id: workWarehouse.id,
        to_warehouse_id:   generalWarehouse.id,
        quantity,
        unit_cost:         parseFloat(stockItem.average_cost),
        movement_type:     'TRASLADO_BODEGA',
        reference_note:    `Sobrante de obra ID: ${work_id}`,
        work_id,
        created_by,
        origin_work_id:    work_id,   // trazabilidad v2.0
      }, t);

      results.push({ product_id, quantity, movement_id: movId });
    }

    await t.commit();
    return results;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// ── Asignar material de bodega a nueva obra ───────────────────
const assignFromWarehouse = async ({ product_id, quantity, to_work_id, company_id, created_by }) => {
  const t = await sequelize.transaction();
  try {
    const [generalWarehouse, toWorkWarehouse] = await Promise.all([
      Warehouse.findOne({ where: { type: 'GENERAL', company_id }, transaction: t }),
      Warehouse.findOne({ where: { work_id: to_work_id, type: 'OBRA', company_id }, transaction: t }),
    ]);

    if (!generalWarehouse) throw createError('Bodega general no encontrada', 404);
    if (!toWorkWarehouse)  throw createError('Almacén de obra destino no encontrado', 404);

    // Stock disponible en bodega general
    const stockItem = await WarehouseItem.findOne({
      where: { warehouse_id: generalWarehouse.id, product_id },
      transaction: t,
    });

    if (!stockItem || stockItem.getAvailable() < quantity) {
      throw createError('Stock insuficiente en bodega general', 400);
    }

    // Obtener precio de referencia del producto
    const product = await Product.findByPk(product_id, { transaction: t });
    const refPrice    = parseFloat(product?.reference_price || 0);
    const actualCost  = parseFloat(stockItem.average_cost);
    const savedAmount = (refPrice - actualCost) * quantity;

    // Registrar movimiento
    const movId = await registerMovement({
      company_id,
      product_id,
      from_warehouse_id: generalWarehouse.id,
      to_warehouse_id:   toWorkWarehouse.id,
      quantity,
      unit_cost:         actualCost,
      movement_type:     'ASIGNACION_OBRA',
      reference_note:    `Asignado desde bodega general a obra ID: ${to_work_id}`,
      work_id:           to_work_id,
      created_by,
    }, t);

    // Registrar ahorro
    if (savedAmount > 0) {
      await WarehouseSaving.create({
        company_id,
        work_id:         to_work_id,
        product_id,
        movement_id:     movId,
        quantity,
        reference_price: refPrice,
        actual_cost:     actualCost,
        saved_amount:    savedAmount,
      }, { transaction: t });
    }

    await t.commit();
    return { movement_id: movId, saved_amount: savedAmount };
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// ── KPI eficiencia de material ────────────────────────────────
const getMaterialEfficiency = async (company_id, work_id = null) => {
  const whereClause = work_id ? `AND w.id = ${work_id}` : '';
  const rows = await sequelize.query(
    `SELECT * FROM v_material_efficiency WHERE company_id = :company_id ${whereClause}`,
    { replacements: { company_id }, type: QueryTypes.SELECT }
  );
  return rows;
};

// ── Stock disponible con sugerencias antes de comprar ─────────
const getStockSuggestions = async (company_id, productIds) => {
  const rows = await sequelize.query(
    `SELECT * FROM v_warehouse_stock
     WHERE company_id = :company_id
       AND product_id = ANY(:ids)
       AND warehouse_type = 'GENERAL'
       AND available_quantity > 0`,
    {
      replacements: { company_id, ids: productIds },
      type: QueryTypes.SELECT,
    }
  );
  return rows;
};

// ── Crear almacén para una nueva obra ────────────────────────
const createWorkWarehouse = async (company_id, work_id, work_name, transaction = null) => {
  return Warehouse.create({
    company_id,
    work_id,
    name:      `Almacén — ${work_name}`,
    type:      'OBRA',
    is_active: true,
  }, { transaction });
};

// ── Asegurar que existe la bodega general ────────────────────
const ensureGeneralWarehouse = async (company_id) => {
  const [warehouse] = await Warehouse.findOrCreate({
    where:    { company_id, type: 'GENERAL' },
    defaults: { name: 'Bodega General', type: 'GENERAL', is_active: true, company_id },
  });
  return warehouse;
};

module.exports = {
  registerMovement,
  reserveStock,
  consumeFromReport,
  transferSurplusToGeneral,
  assignFromWarehouse,
  getMaterialEfficiency,
  getStockSuggestions,
  createWorkWarehouse,
  ensureGeneralWarehouse,
};
