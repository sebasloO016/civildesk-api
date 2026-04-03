const { AuditLog } = require('../models');

// ── Middleware de auditoría automática ────────────────────────
// Registra INSERT, UPDATE, DELETE en audit_logs
const auditMiddleware = (tableName) => {
  return async (req, res, next) => {
    // Guardar el método original de res.json
    const originalJson = res.json.bind(res);

    res.json = async (body) => {
      // Solo registrar operaciones de escritura exitosas
      if (
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
        body?.success &&
        body?.data?.id
      ) {
        try {
          const actionMap = {
            POST:   'INSERT',
            PUT:    'UPDATE',
            PATCH:  'UPDATE',
            DELETE: 'DELETE',
          };

          await AuditLog.create({
            company_id:  req.company_id,
            user_id:     req.user?.id,
            table_name:  tableName,
            record_id:   body.data.id,
            action:      actionMap[req.method],
            old_values:  req.oldValues || null,
            new_values:  req.method !== 'DELETE' ? body.data : null,
            ip_address:  req.ip,
            user_agent:  req.headers['user-agent'],
          });
        } catch (auditErr) {
          // Nunca bloquear la respuesta por un error de auditoría
          console.error('Audit log error:', auditErr.message);
        }
      }
      return originalJson(body);
    };

    next();
  };
};

module.exports = { auditMiddleware };
