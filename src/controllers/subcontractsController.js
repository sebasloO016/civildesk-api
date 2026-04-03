const { Op }        = require('sequelize');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const {
  Subcontract, SubcontractPayment, Supplier, Work,
} = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError } = require('../middlewares/errorHandler');

// ── GET /works/:workId/subcontracts ───────────────────────────
const getAll = async (req, res, next) => {
  try {
    const subcontracts = await Subcontract.findAll({
      where:   { work_id: req.params.workId, company_id: req.company_id },
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id','name','phone','email'] },
        { model: SubcontractPayment, as: 'payments', order: [['payment_date','DESC']] },
      ],
      order: [['created_at', 'DESC']],
    });

    // Calcular saldo pendiente por subcontrato
    const enriched = subcontracts.map(s => {
      const data = s.toJSON();
      data.pending_amount = parseFloat(data.contracted_amount) - parseFloat(data.paid_amount);
      data.progress_vs_payment = parseFloat(data.paid_amount) > 0
        ? Math.round((parseFloat(data.progress_pct) / (parseFloat(data.paid_amount) / parseFloat(data.contracted_amount) * 100)) * 100) / 100
        : null;
      return data;
    });

    return success(res, enriched);
  } catch (err) { next(err); }
};

// ── POST /works/:workId/subcontracts ──────────────────────────
const create = async (req, res, next) => {
  try {
    const subcontract = await Subcontract.create({
      ...req.body,
      work_id:    req.params.workId,
      company_id: req.company_id,
      paid_amount: 0,
      progress_pct: 0,
    });

    const full = await Subcontract.findByPk(subcontract.id, {
      include: [{ model: Supplier, as: 'supplier', attributes: ['id','name','phone'] }],
    });

    return created(res, full, 'Subcontrato creado');
  } catch (err) { next(err); }
};

// ── PUT /works/:workId/subcontracts/:id ───────────────────────
const update = async (req, res, next) => {
  try {
    const sub = await Subcontract.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
    });
    if (!sub) throw createError('Subcontrato no encontrado', 404);
    await sub.update(req.body);
    return success(res, sub, 'Subcontrato actualizado');
  } catch (err) { next(err); }
};

// ── DELETE /works/:workId/subcontracts/:id ────────────────────
const remove = async (req, res, next) => {
  try {
    const sub = await Subcontract.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
    });
    if (!sub) throw createError('Subcontrato no encontrado', 404);
    if (parseFloat(sub.paid_amount) > 0) throw createError('No se puede eliminar: tiene pagos registrados', 400);
    await sub.update({ status: 'CANCELLED' });
    return success(res, { id: sub.id }, 'Subcontrato cancelado');
  } catch (err) { next(err); }
};

// ── POST /works/:workId/subcontracts/:id/payments ─────────────
const addPayment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const sub = await Subcontract.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
      transaction: t,
    });
    if (!sub) throw createError('Subcontrato no encontrado', 404);

    const { amount, payment_date, payment_method, reference, notes } = req.body;
    const payAmt = parseFloat(amount);

    // Verificar que no supere el monto contratado
    const newPaid = parseFloat(sub.paid_amount) + payAmt;
    if (newPaid > parseFloat(sub.contracted_amount)) {
      throw createError(
        `El pago excede el monto contratado. Máximo permitido: $${(parseFloat(sub.contracted_amount) - parseFloat(sub.paid_amount)).toFixed(2)}`,
        400
      );
    }

    // Crear pago
    const payment = await SubcontractPayment.create({
      company_id:     req.company_id,
      subcontract_id: sub.id,
      amount:         payAmt,
      payment_date,
      payment_method,
      reference,
      notes,
    }, { transaction: t });

    // Actualizar monto pagado en el subcontrato
    await sub.update({ paid_amount: newPaid }, { transaction: t });

    // ── Sincronizar automáticamente con finanzas ──────────────
    const { FinancialTransaction } = require('../models');
    await FinancialTransaction.create({
      company_id:       req.company_id,
      work_id:          sub.work_id,
      type:             'EXPENSE',
      category:         'SUBCONTRACT',
      description:      `Pago subcontrato ${sub.specialty} — ${reference || payment_method || 'Sin referencia'}`,
      amount:           payAmt,
      transaction_date: payment_date,
      recorded_by:      req.user.id,
    }, { transaction: t });

    await t.commit();

    return created(res, {
      payment: payment.toJSON(),
      new_paid_amount: newPaid,
      pending_amount:  parseFloat(sub.contracted_amount) - newPaid,
    }, 'Pago registrado');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ── GET /works/:workId/subcontracts/summary ───────────────────
const getSummary = async (req, res, next) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(contracted_amount), 0) AS total_contracted,
        COALESCE(SUM(paid_amount), 0)       AS total_paid,
        COALESCE(SUM(contracted_amount - paid_amount), 0) AS total_pending,
        COALESCE(AVG(progress_pct), 0)      AS avg_progress,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')    AS active_count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_count
      FROM subcontracts
      WHERE work_id = :work_id AND company_id = :company_id
        AND status != 'CANCELLED'
    `, {
      replacements: { work_id: req.params.workId, company_id: req.company_id },
      type: QueryTypes.SELECT,
    });
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

module.exports = { getAll, create, update, remove, addPayment, getSummary };
