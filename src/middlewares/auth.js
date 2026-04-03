const jwt     = require('jsonwebtoken');
const { User, Role } = require('../models');

// ── Verificar token JWT ───────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token no proporcionado' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({
      where: { id: decoded.id, is_active: true },
      include: [{ model: Role, as: 'role' }],
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
    }

    // Adjuntar usuario y company_id al request
    req.user       = user;
    req.company_id = user.company_id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expirado' });
    }
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

// ── Verificar permiso de módulo ───────────────────────────────
const authorize = (...modules) => {
  return (req, res, next) => {
    const permissions = req.user?.role?.permissions || {};
    const hasPermission = modules.some(mod => permissions[mod] === true);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a este módulo',
      });
    }
    next();
  };
};

// ── Solo Admin ────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role?.name !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Acceso solo para administradores' });
  }
  next();
};

module.exports = { authenticate, authorize, adminOnly };
