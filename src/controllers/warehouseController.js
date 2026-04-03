const { sequelize }    = require('../config/database');
const { QueryTypes }   = require('sequelize');
const { Warehouse, WarehouseItem, InventoryMovement, Product } = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError }  = require('../middlewares/errorHandler');
const inventoryService = require('../services/inventory/inventoryService');

// ── GET /warehouses ──────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const warehouses = await Warehouse.findAll({
      where:   { company_id: req.company_id, is_active: true },
      include: [{ model: WarehouseItem, as: 'items',
        include: [{ model: Product, as: 'product' }] }],
    });
    return success(res, warehouses);
  } catch (err) { next(err); }
};

// ── GET /warehouses/stock (vista v_warehouse_stock) ──────────
const getStock = async (req, res, next) => {
  try {
    const { type, below_minimum } = req.query;

    let query = `SELECT * FROM v_warehouse_stock WHERE company_id = :company_id`;
    const replacements = { company_id: req.company_id };

    if (type)          { query += ` AND warehouse_type = :type`; replacements.type = type; }
    if (below_minimum === 'true') query += ` AND below_minimum = true`;

    query += ` ORDER BY warehouse_name, product_name`;

    const rows = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });
    return success(res, rows);
  } catch (err) { next(err); }
};

// ── GET /warehouses/stock/suggestions ────────────────────────
// Antes de una orden de compra: qué tengo disponible en bodega
const getStockSuggestions = async (req, res, next) => {
  try {
    const { product_ids } = req.query;
    if (!product_ids) return success(res, []);

    const ids = product_ids.split(',').map(Number);
    const rows = await inventoryService.getStockSuggestions(req.company_id, ids);
    return success(res, rows);
  } catch (err) { next(err); }
};

// ── POST /warehouses/assign ──────────────────────────────────
// Asignar material de bodega general a una obra
const assignToWork = async (req, res, next) => {
  try {
    const { product_id, quantity, to_work_id } = req.body;

    const result = await inventoryService.assignFromWarehouse({
      product_id,
      quantity,
      to_work_id,
      company_id: req.company_id,
      created_by: req.user.id,
    });

    return success(res, result, `Material asignado. Ahorro generado: $${result.saved_amount}`);
  } catch (err) { next(err); }
};

// ── POST /warehouses/reserve ─────────────────────────────────
// Reservar stock para una obra
const reserveStock = async (req, res, next) => {
  try {
    const { warehouse_id, product_id, quantity, work_id } = req.body;

    await inventoryService.reserveStock({
      warehouse_id, product_id, quantity, work_id,
      company_id: req.company_id,
      created_by: req.user.id,
    });

    return success(res, null, 'Stock reservado correctamente');
  } catch (err) { next(err); }
};

// ── GET /warehouses/movements ────────────────────────────────
const getMovements = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, movement_type, work_id, product_id } = req.query;
    const { Op } = require('sequelize');
    const where  = { company_id: req.company_id };

    if (movement_type) where.movement_type = movement_type;
    if (work_id)       where.work_id       = work_id;
    if (product_id)    where.product_id    = product_id;

    const { rows, count } = await InventoryMovement.findAndCountAll({
      where,
      include: [
        { model: Product,   as: 'product',       attributes: ['id','name','unit'] },
        { model: Warehouse, as: 'fromWarehouse',  attributes: ['id','name','type'], required: false },
        { model: Warehouse, as: 'toWarehouse',    attributes: ['id','name','type'], required: false },
      ],
      order:  [['movement_date', 'DESC'], ['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// ── GET /warehouses/efficiency ────────────────────────────────
const getMaterialEfficiency = async (req, res, next) => {
  try {
    const { work_id } = req.query;
    const rows = await inventoryService.getMaterialEfficiency(req.company_id, work_id || null);
    return success(res, rows);
  } catch (err) { next(err); }
};

// ── GET /warehouses/export-excel ─────────────────────────────
const exportExcel = async (req, res, next) => {
  try {
    const rows = await sequelize.query(
      `SELECT * FROM v_warehouse_stock WHERE company_id = :company_id ORDER BY warehouse_name, product_name`,
      { replacements: { company_id: req.company_id }, type: QueryTypes.SELECT }
    );

    // Generar CSV (compatible con Excel)
    const headers = [
      'Producto','Almacén','Tipo','Disponible','Reservado','Total',
      'Costo Promedio','Valor Total','Último Movimiento','Bajo Mínimo'
    ];

    const csvRows = rows.map(r => [
      r.product_name,
      r.warehouse_name,
      r.warehouse_type,
      parseFloat(r.available_quantity).toFixed(2),
      parseFloat(r.reserved_quantity).toFixed(2),
      parseFloat(r.quantity).toFixed(2),
      parseFloat(r.average_cost).toFixed(2),
      parseFloat(r.available_value).toFixed(2),
      r.last_movement ? new Date(r.last_movement).toLocaleDateString('es-EC') : '',
      r.below_minimum ? 'SÍ' : 'NO',
    ]);

    const csv = [headers, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // BOM para que Excel abra UTF-8 correctamente
    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventario-${Date.now()}.csv"`);
    res.end(bom + csv);
  } catch (err) { next(err); }
};

module.exports = { getAll, getStock, getStockSuggestions, assignToWork, reserveStock, getMovements, getMaterialEfficiency, exportExcel };
