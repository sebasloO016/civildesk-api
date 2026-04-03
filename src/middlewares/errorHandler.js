const logger = require('../config/logger');

// ── Manejador de errores global ───────────────────────────────
const errorHandler = (err, req, res, next) => {
  logger.error(`${err.message} | ${req.method} ${req.originalUrl}`, err);

  // Error de validación de Sequelize
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const messages = err.errors.map(e => e.message);
    return res.status(400).json({ success: false, message: 'Error de validación', errors: messages });
  }

  // Error de clave foránea
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ success: false, message: 'Referencia a registro inexistente' });
  }

  // Error JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }

  // Error personalizado con statusCode
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor',
  });
};

// ── 404 para rutas no encontradas ─────────────────────────────
const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Ruta ${req.originalUrl} no encontrada` });
};

// ── Helper: crear error con código HTTP ───────────────────────
const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { errorHandler, notFound, createError };
