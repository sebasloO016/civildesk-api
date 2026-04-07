const { Op }        = require('sequelize');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const {
  DailyReport, ReportPurchase, ReportPhoto, ReportContractor,
  FinancialTransaction, Product, SupplierProduct, PriceHistory,
} = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError } = require('../middlewares/errorHandler');

// ── GET /works/:workId/reports ────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { rows, count } = await DailyReport.findAndCountAll({
      where:   { work_id: req.params.workId, company_id: req.company_id },
      include: [
        { model: ReportPurchase,   as: 'purchases' },
        { model: ReportPhoto,      as: 'photos' },
        { model: ReportContractor, as: 'contractors' },
      ],
      order:   [['report_date', 'DESC']],
      limit:   parseInt(limit),
      offset:  (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// ── GET /works/:workId/reports/stats ──────────────────────────
const getStats = async (req, res, next) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        COUNT(DISTINCT dr.id)                                    AS total_reports,
        COALESCE(SUM(rp.quantity * rp.unit_price), 0)           AS total_purchases,
        COALESCE(AVG(dr.workers_count), 0)                      AS avg_workers,
        COALESCE(AVG(rc_totals.contractor_workers), 0)          AS avg_contractor_workers,
        MAX(dr.report_date)                                      AS last_report_date,
        COUNT(DISTINCT dr.id) FILTER (
          WHERE dr.report_date >= NOW() - INTERVAL '7 days'
        )                                                        AS reports_last_week
      FROM daily_reports dr
      LEFT JOIN report_purchases rp ON rp.daily_report_id = dr.id
      LEFT JOIN (
        SELECT daily_report_id, SUM(workers_count) AS contractor_workers
        FROM report_contractors
        GROUP BY daily_report_id
      ) rc_totals ON rc_totals.daily_report_id = dr.id
      WHERE dr.work_id = :work_id AND dr.company_id = :company_id
    `, {
      replacements: { work_id: req.params.workId, company_id: req.company_id },
      type: QueryTypes.SELECT,
    });
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

// ── GET /works/:workId/reports/:id ────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const report = await DailyReport.findOne({
      where:   { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
      include: [
        { model: ReportPurchase,   as: 'purchases' },
        { model: ReportPhoto,      as: 'photos' },
        { model: ReportContractor, as: 'contractors' },
      ],
    });
    if (!report) throw createError('Reporte no encontrado', 404);
    return success(res, report);
  } catch (err) { next(err); }
};

// ── GET /products/match?q=texto  (fuzzy match para compras campo) ──
const matchProducts = async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    if (q.length < 2) return success(res, []);

    const products = await Product.findAll({
      where: {
        company_id: req.company_id,
        is_active:  true,
        [Op.or]: [
          { name:        { [Op.iLike]: `%${q}%` } },
          { code:        { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
        ],
      },
      limit: 8,
      attributes: ['id', 'name', 'code', 'unit', 'category', 'reference_price'],
    });

    return success(res, products);
  } catch (err) { next(err); }
};

// ── Helper: sync price to supplier_products catalog ───────────
const syncPriceToSupplier = async ({ company_id, supplier_id, product_id, unit_price, recorded_by }, t) => {
  if (!supplier_id || !product_id || !unit_price) return;
  const price = parseFloat(unit_price);
  if (price <= 0) return;

  const existing = await SupplierProduct.findOne({
    where: { supplier_id, product_id },
    transaction: t,
  });

  if (existing) {
    const oldPrice = parseFloat(existing.unit_price);
    if (Math.abs(oldPrice - price) < 0.001) return;
    const variation = oldPrice > 0 ? ((price - oldPrice) / oldPrice) * 100 : null;
    await sequelize.query(`
      INSERT INTO product_price_history
        (company_id, supplier_id, product_id, old_price, new_price, variation_pct, recorded_by, recorded_at)
      VALUES (:cid, :sid, :pid, :old, :new, :var, :uid, NOW())
    `, {
      replacements: {
        cid: company_id, sid: supplier_id, pid: product_id,
        old: oldPrice, new: price,
        var: variation ? Math.round(variation * 100) / 100 : null,
        uid: recorded_by,
      },
      type: QueryTypes.INSERT,
      transaction: t,
    });
    await existing.update({ unit_price: price, last_updated: new Date() }, { transaction: t });
  } else {
    await sequelize.query(`
      INSERT INTO supplier_products (company_id, supplier_id, product_id, unit_price, last_updated)
      VALUES (:cid, :sid, :pid, :price, NOW())
      ON CONFLICT (supplier_id, product_id) DO UPDATE
      SET unit_price = EXCLUDED.unit_price, last_updated = NOW()
    `, {
      replacements: { cid: company_id, sid: supplier_id, pid: product_id, price },
      type: QueryTypes.INSERT,
      transaction: t,
    });
  }
};

// ── POST /works/:workId/reports ───────────────────────────────
const create = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      report_date, weather, activities, novelties,
      workers_count, photos = [], purchases = [], contractors = [],
    } = req.body;

    const existing = await DailyReport.findOne({
      where: { work_id: req.params.workId, report_date, company_id: req.company_id },
      transaction: t,
    });
    if (existing) throw createError('Ya existe un reporte para esta fecha', 409);

    const totalPurchases = purchases.reduce((s, p) => {
      return s + (parseFloat(p.quantity || 0) * parseFloat(p.unit_price || 0));
    }, 0);

    const report = await DailyReport.create({
      company_id:   req.company_id,
      work_id:      req.params.workId,
      created_by:   req.user.id,
      report_date, weather, activities, novelties, workers_count,
    }, { transaction: t });

    if (photos.length) {
      await ReportPhoto.bulkCreate(
        photos.map(p => ({ ...p, daily_report_id: report.id, company_id: req.company_id })),
        { transaction: t }
      );
    }

    const validContractors = contractors.filter(c => c.supplier_id);
    if (validContractors.length) {
      await ReportContractor.bulkCreate(
        validContractors.map(c => ({
          daily_report_id: report.id,
          supplier_id:     parseInt(c.supplier_id),
          workers_count:   parseInt(c.workers_count || 1),
          activity:        c.name || c.activity || null,
        })),
        { transaction: t }
      );
    }

    if (purchases.length) {
      const savedPurchases = await ReportPurchase.bulkCreate(
        purchases.map(p => ({
          daily_report_id: report.id,
          company_id:      req.company_id,
          work_id:         req.params.workId,
          supplier_id:     p.supplier_id || null,
          product_id:      p.product_id  || null,
          description:     p.description,
          quantity:        parseFloat(p.quantity   || 1),
          unit:            p.unit || 'unidad',
          unit_price:      parseFloat(p.unit_price || 0),
          is_billed:       false,
        })),
        { transaction: t, returning: true }
      );

      for (const p of purchases) {
        if (p.supplier_id && p.product_id && parseFloat(p.unit_price) > 0) {
          await syncPriceToSupplier({
            company_id:  req.company_id,
            supplier_id: parseInt(p.supplier_id),
            product_id:  parseInt(p.product_id),
            unit_price:  parseFloat(p.unit_price),
            recorded_by: req.user.id,
          }, t);
        }
      }

      if (totalPurchases > 0) {
        const tx = await FinancialTransaction.create({
          company_id:       req.company_id,
          work_id:          req.params.workId,
          type:             'EXPENSE',
          category:         'MATERIAL_PURCHASE',
          description:      `Compras reporte diario — ${report_date}`,
          amount:           Math.round(totalPurchases * 100) / 100,
          transaction_date: report_date,
          recorded_by:      req.user.id,
          is_reconciled:    false,
        }, { transaction: t });

        for (const rp of savedPurchases) {
          await rp.update({ financial_tx_id: tx.id }, { transaction: t });
        }
      }
    }

    await t.commit();

    const full = await DailyReport.findByPk(report.id, {
      include: [
        { model: ReportPurchase,   as: 'purchases' },
        { model: ReportPhoto,      as: 'photos' },
        { model: ReportContractor, as: 'contractors' },
      ],
    });
    return created(res, full, 'Reporte diario creado');
  } catch (err) { await t.rollback(); next(err); }
};

// ── PUT /works/:workId/reports/:id ────────────────────────────
const update = async (req, res, next) => {
  try {
    const report = await DailyReport.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
    });
    if (!report) throw createError('Reporte no encontrado', 404);
    const { photos, purchases, contractors, ...data } = req.body;
    await report.update(data);
    return success(res, report, 'Reporte actualizado');
  } catch (err) { next(err); }
};

// ── POST /works/:workId/reports/:id/photos ────────────────────
const addPhoto = async (req, res, next) => {
  try {
    const report = await DailyReport.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
    });
    if (!report) throw createError('Reporte no encontrado', 404);
    const photo = await ReportPhoto.create({
      ...req.body,
      daily_report_id: report.id,
      company_id:      req.company_id,
    });
    return created(res, photo, 'Foto agregada');
  } catch (err) { next(err); }
};

// ── DELETE /works/:workId/reports/:id/photos/:photoId ─────────
const removePhoto = async (req, res, next) => {
  try {
    const photo = await ReportPhoto.findOne({
      where: { id: req.params.photoId, company_id: req.company_id },
    });
    if (!photo) throw createError('Foto no encontrada', 404);
    await photo.destroy();
    return success(res, { id: photo.id }, 'Foto eliminada');
  } catch (err) { next(err); }
};

// ── POST /works/:workId/reports/:id/contractors ───────────────
const addContractor = async (req, res, next) => {
  try {
    const report = await DailyReport.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
    });
    if (!report) throw createError('Reporte no encontrado', 404);
    const { supplier_id, workers_count, activity } = req.body;
    if (!supplier_id) throw createError('supplier_id requerido', 400);
    const contractor = await ReportContractor.create({
      daily_report_id: report.id,
      supplier_id:     parseInt(supplier_id),
      workers_count:   parseInt(workers_count || 1),
      activity:        activity || null,
    });
    return created(res, contractor, 'Contratista agregado');
  } catch (err) { next(err); }
};

// ── DELETE /works/:workId/reports/:id/contractors/:cid ────────
const removeContractor = async (req, res, next) => {
  try {
    const contractor = await ReportContractor.findOne({
      where: { id: req.params.cid },
    });
    if (!contractor) throw createError('Contratista no encontrado', 404);
    await contractor.destroy();
    return success(res, { id: contractor.id }, 'Contratista eliminado');
  } catch (err) { next(err); }
};

module.exports = {
  getAll, getOne, getStats, matchProducts,
  create, update,
  addPhoto, removePhoto,
  addContractor, removeContractor,
};
