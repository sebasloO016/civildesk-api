const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const {
  ProgressCertificate, Work, Client, Company, User,
} = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError } = require('../middlewares/errorHandler');

// ── GET /works/:workId/certificates ──────────────────────────
const getAll = async (req, res, next) => {
  try {
    const certs = await ProgressCertificate.findAll({
      where:   { work_id: req.params.workId, company_id: req.company_id },
      order:   [['created_at', 'DESC']],
    });
    return success(res, certs);
  } catch (err) { next(err); }
};

// ── POST /works/:workId/certificates ─────────────────────────
const create = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      period, progress_pct, amount_to_bill, notes,
    } = req.body;

    const work = await Work.findOne({
      where:   { id: req.params.workId, company_id: req.company_id },
      transaction: t,
    });
    if (!work) throw createError('Obra no encontrada', 404);

    const count = await ProgressCertificate.count({
      where: { work_id: req.params.workId },
      transaction: t,
    });
    const certificate_number = `CERT-${String(work.id).padStart(3,'0')}-${String(count + 1).padStart(2,'0')}`;

    const cert = await ProgressCertificate.create({
      company_id:     req.company_id,
      work_id:        req.params.workId,
      created_by:     req.user.id,
      certificate_number,
      period,
      progress_pct:   parseFloat(progress_pct),
      amount_to_bill: parseFloat(amount_to_bill),
      notes,
      status:         'DRAFT',
    }, { transaction: t });

    await t.commit();
    return created(res, cert, 'Certificado creado');
  } catch (err) { await t.rollback(); next(err); }
};

// ── PATCH /works/:workId/certificates/:id/approve ────────────
const approve = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const cert = await ProgressCertificate.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
      transaction: t,
    });
    if (!cert) throw createError('Certificado no encontrado', 404);
    if (cert.status !== 'DRAFT') throw createError('Solo se pueden aprobar certificados en borrador', 400);

    await cert.update({ status: 'SENT', issued_at: new Date() }, { transaction: t });

    // Registrar ingreso financiero automático
    const { FinancialTransaction } = require('../models');
    await FinancialTransaction.create({
      company_id:       req.company_id,
      work_id:          req.params.workId,
      type:             'INCOME',
      category:         'PARTIAL_PAYMENT',
      description:      `Certificado de avance ${cert.certificate_number} — ${cert.period}`,
      amount:           parseFloat(cert.amount_to_bill),
      transaction_date: new Date().toISOString().substring(0, 10),
      recorded_by:      req.user.id,
    }, { transaction: t });

    await t.commit();
    return success(res, cert, 'Certificado aprobado — ingreso registrado en finanzas');
  } catch (err) { await t.rollback(); next(err); }
};

// ── DELETE /works/:workId/certificates/:id ────────────────────
const remove = async (req, res, next) => {
  try {
    const cert = await ProgressCertificate.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
    });
    if (!cert) throw createError('Certificado no encontrado', 404);
    if (cert.status === 'SENT' || cert.status === 'PAID') throw createError('No se puede eliminar un certificado enviado o pagado', 400);
    await cert.destroy();
    return success(res, { id: cert.id }, 'Certificado eliminado');
  } catch (err) { next(err); }
};

module.exports = { getAll, create, approve, remove };
