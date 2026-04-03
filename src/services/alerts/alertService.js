const { sequelize } = require('../../config/database');
const { QueryTypes } = require('sequelize');
const { Alert }     = require('../../models');

// ── Generar alertas inteligentes (llama función PG) ──────────
const generateSmartAlerts = async (company_id) => {
  const [rows] = await sequelize.query(
    `SELECT generate_smart_alerts(:company_id) AS count`,
    { replacements: { company_id }, type: QueryTypes.SELECT }
  );
  return rows?.count || 0;
};

// ── Generar alertas para todas las empresas activas ──────────
const runAlertsForAll = async () => {
  const { Company } = require('../../models');
  const companies = await Company.findAll({ where: { is_active: true }, attributes: ['id'] });

  let total = 0;
  for (const company of companies) {
    const count = await generateSmartAlerts(company.id);
    total += parseInt(count);
  }
  return total;
};

// ── Obtener alertas de una empresa ───────────────────────────
const getAlerts = async (company_id, { unread_only = false, page = 1, limit = 20 } = {}) => {
  const where = { company_id };
  if (unread_only) where.is_read = false;

  const { rows, count } = await Alert.findAndCountAll({
    where,
    order:  [['created_at', 'DESC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });

  return { rows, count };
};

// ── Marcar alerta como leída ─────────────────────────────────
const markAsRead = async (alert_id, company_id) => {
  const alert = await Alert.findOne({ where: { id: alert_id, company_id } });
  if (!alert) throw new Error('Alerta no encontrada');

  await alert.update({ is_read: true, read_at: new Date() });
  return alert;
};

// ── Marcar todas como leídas ─────────────────────────────────
const markAllAsRead = async (company_id) => {
  await Alert.update(
    { is_read: true, read_at: new Date() },
    { where: { company_id, is_read: false } }
  );
};

// ── Crear alerta manual ──────────────────────────────────────
const createAlert = async ({ company_id, user_id = null, type, title, message, entity_type, entity_id, severity = 'INFO' }) => {
  return Alert.create({ company_id, user_id, type, title, message, entity_type, entity_id, severity });
};

module.exports = {
  generateSmartAlerts,
  runAlertsForAll,
  getAlerts,
  markAsRead,
  markAllAsRead,
  createAlert,
};
