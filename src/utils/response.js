// ── Respuestas estandarizadas ─────────────────────────────────

const success = (res, data = null, message = 'OK', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

const created = (res, data = null, message = 'Creado exitosamente') => {
  return res.status(201).json({ success: true, message, data });
};

const paginated = (res, rows, count, page, limit) => {
  return res.status(200).json({
    success:    true,
    data:       rows,
    pagination: {
      total:       count,
      page:        parseInt(page),
      limit:       parseInt(limit),
      totalPages:  Math.ceil(count / limit),
      hasNext:     page * limit < count,
      hasPrev:     page > 1,
    },
  });
};

const error = (res, message = 'Error', statusCode = 400, errors = null) => {
  return res.status(statusCode).json({ success: false, message, ...(errors && { errors }) });
};

module.exports = { success, created, paginated, error };
