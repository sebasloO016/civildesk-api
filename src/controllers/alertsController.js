const alertService = require('../services/alerts/alertService');
const { success }  = require('../utils/response');

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const { rows, count } = await alertService.getAlerts(req.company_id, {
      unread_only: unread_only === 'true', page, limit,
    });
    return success(res, { alerts: rows, total: count, unread: rows.filter(a => !a.is_read).length });
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    const alert = await alertService.markAsRead(req.params.id, req.company_id);
    return success(res, alert, 'Alerta marcada como leída');
  } catch (err) { next(err); }
};

const markAllRead = async (req, res, next) => {
  try {
    await alertService.markAllAsRead(req.company_id);
    return success(res, null, 'Todas las alertas marcadas como leídas');
  } catch (err) { next(err); }
};

// Disparar manualmente (útil para testing)
const runNow = async (req, res, next) => {
  try {
    const count = await alertService.generateSmartAlerts(req.company_id);
    return success(res, { generated: count }, `${count} alertas generadas`);
  } catch (err) { next(err); }
};

module.exports = { getAll, markRead, markAllRead, runNow };
