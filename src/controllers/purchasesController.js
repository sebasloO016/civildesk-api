const { Op } = require('sequelize');
const { sequelize } = require('../models');
const {
  PurchaseRequest, PurchaseRequestItem,
  PurchaseOrder, PurchaseOrderItem,
  PurchaseInvoice, Supplier, Product,
  FinancialTransaction, Work, ReportPurchase,
} = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError }    = require('../middlewares/errorHandler');
const inventoryService   = require('../services/inventory/inventoryService');
const { variationPct }   = require('../utils/budgetCalculator');

// ═══════════════════════════════════════════════════════════════
// SOLICITUDES DE COMPRA
// ═══════════════════════════════════════════════════════════════

const getAllRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, work_id } = req.query;
    const where = { company_id: req.company_id };
    if (status)  where.status  = status;
    if (work_id) where.work_id = work_id;

    const { rows, count } = await PurchaseRequest.findAndCountAll({
      where,
      include: [
        { model: PurchaseRequestItem, as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id','name','unit'] }] },
        { model: Work, as: 'work', attributes: ['id','name'] },
      ],
      order:  [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

const createRequest = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { items = [], ...requestData } = req.body;

    const request = await PurchaseRequest.create({
      ...requestData,
      company_id: req.company_id,
      created_by: req.user.id,
      request_number: `REQ-${Date.now()}`,
    }, { transaction: t });

    // Guardar items con precio de referencia al momento
    if (items.length) {
      const enriched = await Promise.all(items.map(async (item) => {
        let refPrice = item.reference_price || 0;
        if (item.product_id && !refPrice) {
          const prod = await Product.findByPk(item.product_id, { transaction: t });
          refPrice = parseFloat(prod?.reference_price || 0);
        }
        return { ...item, purchase_request_id: request.id, reference_price: refPrice };
      }));
      await PurchaseRequestItem.bulkCreate(enriched, { transaction: t });
    }

    await t.commit();

    const full = await PurchaseRequest.findByPk(request.id, {
      include: [{ model: PurchaseRequestItem, as: 'items' }],
    });
    return created(res, full, 'Solicitud de compra creada');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ── Generar Órdenes de Compra separadas por proveedor ─────────
// POST /purchases/requests/:id/generate-orders
const generateOrdersBySupplier = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const request = await PurchaseRequest.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{ model: PurchaseRequestItem, as: 'items' }],
      transaction: t,
    });
    if (!request) throw createError('Solicitud no encontrada', 404);

    // Agrupar items por supplier_id
    const bySupplier = {};
    for (const item of request.items) {
      if (!item.supplier_id) continue;
      if (!bySupplier[item.supplier_id]) bySupplier[item.supplier_id] = [];
      bySupplier[item.supplier_id].push(item);
    }

    const orders = [];
    for (const [supplier_id, items] of Object.entries(bySupplier)) {
      const subtotal = items.reduce((s, i) => s + (parseFloat(i.quantity) * (parseFloat(i.quoted_price) || parseFloat(i.reference_price) || 0)), 0);
      const tax_pct  = 12;
      const tax_amt  = subtotal * (tax_pct / 100);
      const total    = subtotal + tax_amt;

      const order = await PurchaseOrder.create({
        company_id:          req.company_id,
        purchase_request_id: request.id,
        work_id:             request.work_id,
        supplier_id:         parseInt(supplier_id),
        created_by:          req.user.id,
        order_number:        `OC-${Date.now()}-${supplier_id}`,
        subtotal, tax_pct, tax_amount: tax_amt, total,
      }, { transaction: t });

      await PurchaseOrderItem.bulkCreate(
        items.map(i => ({
          purchase_order_id: order.id,
          product_id:        i.product_id,
          description:       i.description,
          quantity:          i.quantity,
          unit:              i.unit,
          unit_price:        i.quoted_price || i.reference_price || 0,
          total:             parseFloat(i.quantity) * parseFloat(i.quoted_price || i.reference_price || 0),
          reference_price:   i.reference_price,
          variation_pct:     variationPct(parseFloat(i.reference_price), parseFloat(i.quoted_price || 0)),
        })),
        { transaction: t }
      );

      orders.push(order);
    }

    // Actualizar estado de la solicitud
    await request.update({ status: 'ORDERED' }, { transaction: t });

    await t.commit();
    return created(res, orders, `${orders.length} orden(es) de compra generadas`);
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════
// ÓRDENES DE COMPRA
// ═══════════════════════════════════════════════════════════════

const getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, supplier_id, work_id } = req.query;
    const where = { company_id: req.company_id };
    if (status)      where.status      = status;
    if (supplier_id) where.supplier_id = supplier_id;
    if (work_id)     where.work_id     = work_id;

    const { rows, count } = await PurchaseOrder.findAndCountAll({
      where,
      include: [
        { model: Supplier,          as: 'supplier', attributes: ['id','name','email','phone'] },
        { model: Work,              as: 'work',     attributes: ['id','name'] },
        { model: PurchaseOrderItem, as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id','name','unit'] }] },
      ],
      order:  [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await PurchaseOrder.findOne({
      where: { id: req.params.id, company_id: req.company_id },
    });
    if (!order) throw createError('Orden no encontrada', 404);

    const { status, proforma_pdf_url } = req.body;
    const updates = { status };
    if (status === 'SENT')      updates.sent_at      = new Date();
    if (status === 'CONFIRMED') updates.confirmed_at = new Date();
    if (status === 'RECEIVED')  updates.received_at  = new Date();
    if (proforma_pdf_url)       updates.proforma_pdf_url = proforma_pdf_url;

    await order.update(updates);
    return success(res, order, `Orden actualizada a ${status}`);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// FACTURAS
// ═══════════════════════════════════════════════════════════════

const createInvoice = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const order = await PurchaseOrder.findOne({
      where:   { id: req.body.purchase_order_id, company_id: req.company_id },
      include: [{ model: PurchaseOrderItem, as: 'items' }],
      transaction: t,
    });
    if (!order) throw createError('Orden de compra no encontrada', 404);

    // ── Detectar si hay gastos de reporte diario que ya cubren estos items ──
    // Buscar report_purchases del mismo work_id y período reciente (7 días)
    // que coincidan con los items de la orden y NO estén aún conciliados
    const { report_purchase_ids = [] } = req.body; // el frontend puede enviar IDs explícitos
    let reconciliationNote = '';
    let skipFinancialTx    = false;

    if (report_purchase_ids.length > 0) {
      // Validar que todos los report_purchase_ids pertenecen a la misma empresa y obra
      const reportPurchases = await ReportPurchase.findAll({
        where: {
          id:         report_purchase_ids,
          company_id: req.company_id,
          work_id:    order.work_id,
          is_billed:  false,
        },
        transaction: t,
      });

      if (reportPurchases.length > 0) {
        const totalReportPurchases = reportPurchases.reduce((s, rp) => s + parseFloat(rp.total), 0);

        // Marcar los gastos del reporte como conciliados → ya NO generan nuevo egreso
        for (const rp of reportPurchases) {
          await rp.update({
            is_billed:           true,
            billed_at:           new Date(),
            purchase_invoice_id: null, // se actualizará abajo
          }, { transaction: t });

          // Marcar la transacción financiera original como conciliada
          if (rp.financial_tx_id) {
            await FinancialTransaction.update(
              { is_reconciled: true, description: FinancialTransaction.sequelize.literal(
                `description || ' [Conciliado con factura]'`
              )},
              { where: { id: rp.financial_tx_id }, transaction: t }
            );
          }
        }

        skipFinancialTx    = true;
        reconciliationNote = ` [Concilia ${reportPurchases.length} gasto(s) de reporte diario — $${totalReportPurchases.toFixed(2)}]`;
      }
    }

    // Crear factura
    const invoice = await PurchaseInvoice.create({
      ...req.body,
      report_purchase_ids: undefined, // no guardar esto en la factura
      company_id:  req.company_id,
      supplier_id: order.supplier_id,
      work_id:     order.work_id,
    }, { transaction: t });

    // Actualizar el purchase_invoice_id en los report_purchases conciliados
    if (report_purchase_ids.length > 0) {
      await ReportPurchase.update(
        { purchase_invoice_id: invoice.id },
        { where: { id: report_purchase_ids, company_id: req.company_id }, transaction: t }
      );
    }

    // Registrar egreso financiero SOLO si no hubo conciliación previa
    if (order.work_id && !skipFinancialTx) {
      await FinancialTransaction.create({
        company_id:       req.company_id,
        work_id:          order.work_id,
        type:             'EXPENSE',
        category:         'MATERIAL_PURCHASE',
        description:      `Factura ${invoice.invoice_number} - ${order.supplier?.name || 'Proveedor'}${reconciliationNote}`,
        amount:           invoice.total,
        transaction_date: invoice.issue_date,
        supplier_id:      invoice.supplier_id,
        invoice_id:       invoice.id,
        recorded_by:      req.user.id,
        is_reconciled:    true,
      }, { transaction: t });
    } else if (order.work_id && skipFinancialTx) {
      // Actualizar la transacción original del reporte con la referencia a la factura
      await FinancialTransaction.update(
        {
          description:  FinancialTransaction.sequelize.literal(
            `description || ' [Factura: ${invoice.invoice_number}]'`
          ),
          invoice_id:   invoice.id,
        },
        {
          where: {
            report_purchase_id: { [require('sequelize').Op.in]: report_purchase_ids },
            company_id: req.company_id,
          },
          transaction: t,
        }
      );
    }

    // Registrar ingreso de materiales al inventario de la obra
    if (order.work_id) {
      for (const item of order.items) {
        if (item.product_id) {
          const { Warehouse } = require('../models');
          const workWarehouse = await Warehouse.findOne({
            where: { work_id: order.work_id, type: 'OBRA', company_id: req.company_id },
            transaction: t,
          });
          if (workWarehouse) {
            await inventoryService.registerMovement({
              company_id:          req.company_id,
              product_id:          item.product_id,
              from_warehouse_id:   null,
              to_warehouse_id:     workWarehouse.id,
              quantity:            parseFloat(item.quantity),
              unit_cost:           parseFloat(item.unit_price),
              movement_type:       'COMPRA',
              reference_note:      `Factura ${invoice.invoice_number}`,
              work_id:             order.work_id,
              created_by:          req.user.id,
              purchase_invoice_id: invoice.id,
            }, t);
          }
        }
      }
    }

    await order.update({ status: 'RECEIVED', received_at: new Date() }, { transaction: t });
    await t.commit();

    return created(res, invoice,
      skipFinancialTx
        ? `Factura registrada y conciliada con gasto de reporte diario${reconciliationNote}`
        : 'Factura registrada y materiales ingresados al inventario'
    );
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const getAllInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, work_id, supplier_id } = req.query;
    const where = { company_id: req.company_id };
    if (status)      where.status      = status;
    if (work_id)     where.work_id     = work_id;
    if (supplier_id) where.supplier_id = supplier_id;

    const { rows, count } = await PurchaseInvoice.findAndCountAll({
      where,
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id','name'] },
        { model: Work,     as: 'work',     attributes: ['id','name'] },
      ],
      order:  [['issue_date', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// ── GET /purchases/unreconciled ───────────────────────────────
// Gastos de reportes diarios pendientes de vincular a una factura formal
const getUnreconciledPurchases = async (req, res, next) => {
  try {
    const { work_id } = req.query;
    const { QueryTypes } = require('sequelize');

    let whereClause = `WHERE company_id = :company_id AND is_billed = FALSE AND total > 0`;
    const replacements = { company_id: req.company_id };

    if (work_id) {
      whereClause += ` AND work_id = :work_id`;
      replacements.work_id = work_id;
    }

    const rows = await sequelize.query(
      `SELECT * FROM v_unreconciled_purchases ${whereClause} ORDER BY report_date DESC`,
      { replacements, type: QueryTypes.SELECT }
    );

    return success(res, rows);
  } catch (err) { next(err); }
};

module.exports = {
  getAllRequests, createRequest, generateOrdersBySupplier,
  getAllOrders, updateOrderStatus,
  createInvoice, getAllInvoices,
  getUnreconciledPurchases,
};
