const { Op }            = require('sequelize');
const { QueryTypes }    = require('sequelize');
const {
  sequelize,
  FinancialTransaction, Work, Supplier,
} = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError }   = require('../middlewares/errorHandler');

// ── GET /finance/transactions ─────────────────────────────────
const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, work_id, type, category, date_from, date_to } = req.query;
    const where = { company_id: req.company_id };
    if (work_id)  where.work_id  = work_id;
    if (type)     where.type     = type;
    if (category) where.category = category;
    if (date_from || date_to) {
      where.transaction_date = {};
      if (date_from) where.transaction_date[Op.gte] = date_from;
      if (date_to)   where.transaction_date[Op.lte] = date_to;
    }

    const { rows, count } = await FinancialTransaction.findAndCountAll({
      where,
      include: [
        { model: Work,     as: 'work',       attributes: ['id','name'] },
        { model: Supplier, as: 'supplier',   attributes: ['id','name'] },
      ],
      order:  [['transaction_date', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// ── POST /finance/transactions ────────────────────────────────
const createTransaction = async (req, res, next) => {
  try {
    const tx = await FinancialTransaction.create({
      ...req.body,
      company_id:  req.company_id,
      recorded_by: req.user.id,
    });
    return created(res, tx, 'Transacción registrada');
  } catch (err) { next(err); }
};

// ── GET /finance/summary ──────────────────────────────────────
const getSummary = async (req, res, next) => {
  try {
    const { date_from, date_to, work_id } = req.query;
    let dateFilter = '';
    const replacements = { company_id: req.company_id };

    if (date_from) { dateFilter += ` AND transaction_date >= :date_from`; replacements.date_from = date_from; }
    if (date_to)   { dateFilter += ` AND transaction_date <= :date_to`;   replacements.date_to   = date_to; }
    if (work_id)   { dateFilter += ` AND work_id = :work_id`;             replacements.work_id   = work_id; }

    // Desglose por categoría (esta query siempre funciona bien)
    const breakdown = await sequelize.query(`
      SELECT
        type,
        category,
        COALESCE(SUM(amount), 0) AS total,
        COUNT(*) AS count
      FROM financial_transactions
      WHERE company_id = :company_id ${dateFilter}
      GROUP BY type, category
      ORDER BY type, total DESC
    `, { replacements, type: QueryTypes.SELECT });

    // Calcular totales desde el breakdown (más confiable)
    const total_income  = breakdown
      .filter(r => r.type === 'INCOME')
      .reduce((sum, r) => sum + parseFloat(r.total), 0);

    const total_expense = breakdown
      .filter(r => r.type === 'EXPENSE')
      .reduce((sum, r) => sum + parseFloat(r.total), 0);

    const balance       = total_income - total_expense;

    // Ahorro total de bodega
    const savingsRows = await sequelize.query(`
      SELECT COALESCE(SUM(saved_amount), 0) AS total_savings
      FROM warehouse_savings
      WHERE company_id = :company_id
    `, { replacements: { company_id: req.company_id }, type: QueryTypes.SELECT });

    const warehouse_savings = parseFloat(savingsRows[0]?.total_savings || 0);

    return success(res, {
      total_income,
      total_expense,
      balance,
      warehouse_savings,
      breakdown,
    });
  } catch (err) { next(err); }
};

// ── GET /finance/works-summary ────────────────────────────────
// Rentabilidad por obra (usa vista v_work_financial_summary)
const getWorksSummary = async (req, res, next) => {
  try {
    const rows = await sequelize.query(`
      SELECT * FROM v_work_financial_summary
      WHERE company_id = :company_id
      ORDER BY balance DESC
    `, {
      replacements: { company_id: req.company_id },
      type: QueryTypes.SELECT,
    });
    return success(res, rows);
  } catch (err) { next(err); }
};

// ── GET /finance/cashflow ─────────────────────────────────────
// Flujo de caja mensual para gráfico
const getCashflow = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const rows = await sequelize.query(`
      SELECT
        EXTRACT(MONTH FROM transaction_date)::INT AS month,
        COALESCE(SUM(CASE WHEN type = 'INCOME'  THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE WHEN type = 'INCOME'  THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS net
      FROM financial_transactions
      WHERE company_id = :company_id
        AND EXTRACT(YEAR FROM transaction_date) = :year
      GROUP BY month
      ORDER BY month
    `, {
      replacements: { company_id: req.company_id, year },
      type: QueryTypes.SELECT,
    });

    return success(res, rows);
  } catch (err) { next(err); }
};

module.exports = { getTransactions, createTransaction, getSummary, getWorksSummary, getCashflow };
