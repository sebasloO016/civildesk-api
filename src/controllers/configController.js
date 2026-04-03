const bcrypt      = require('bcryptjs');
const { Op }      = require('sequelize');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { Company, User, Role, AuditLog } = require('../models');
const { success, created, paginated }   = require('../utils/response');
const { createError }                   = require('../middlewares/errorHandler');

// ═══════════════════════════════════════════════════════════════
// EMPRESA
// ═══════════════════════════════════════════════════════════════

const getCompany = async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.company_id);
    if (!company) throw createError('Empresa no encontrada', 404);
    return success(res, company);
  } catch (err) { next(err); }
};

const updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findByPk(req.company_id);
    if (!company) throw createError('Empresa no encontrada', 404);

    // Campos permitidos para actualizar
    const allowed = [
      'name', 'ruc', 'email', 'phone', 'address', 'city', 'country',
      'logo_url', 'default_utility_pct', 'default_contingency_pct',
      'price_alert_threshold_pct', 'stock_alert_default_min',
    ];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await company.update(updates);
    return success(res, company, 'Configuración actualizada');
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// USUARIOS
// ═══════════════════════════════════════════════════════════════

const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { rows, count } = await User.findAndCountAll({
      where:   { company_id: req.company_id },
      include: [{ model: Role, as: 'role', attributes: ['id','name'] }],
      attributes: { exclude: ['password_hash'] },
      order:   [['first_name', 'ASC']],
      limit:   parseInt(limit),
      offset:  (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

const createUser = async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, phone, role_id } = req.body;

    const exists = await User.findOne({ where: { email } });
    if (exists) throw createError('El email ya está registrado', 409);

    const password_hash = await bcrypt.hash(password, 12);

    const user = await User.create({
      company_id: req.company_id,
      role_id,
      first_name,
      last_name,
      email,
      password_hash,
      phone,
    });

    const { password_hash: _, ...userData } = user.toJSON();
    return created(res, userData, 'Usuario creado');
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, company_id: req.company_id },
    });
    if (!user) throw createError('Usuario no encontrado', 404);

    const { password, ...rest } = req.body;
    if (password) rest.password_hash = await bcrypt.hash(password, 12);

    await user.update(rest);
    const { password_hash: _, ...userData } = user.toJSON();
    return success(res, userData, 'Usuario actualizado');
  } catch (err) { next(err); }
};

const toggleUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id, company_id: req.company_id },
    });
    if (!user) throw createError('Usuario no encontrado', 404);
    if (user.id === req.user.id) throw createError('No puedes desactivarte a ti mismo', 400);

    await user.update({ is_active: !user.is_active });
    return success(res, { id: user.id, is_active: user.is_active },
      `Usuario ${user.is_active ? 'activado' : 'desactivado'}`);
  } catch (err) { next(err); }
};

const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.findAll({ order: [['name', 'ASC']] });
    return success(res, roles);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════

const getAuditLog = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, entity_type, user_id } = req.query;
    const where = { company_id: req.company_id };
    if (entity_type) where.entity_type = entity_type;
    if (user_id)     where.user_id     = user_id;

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'user',
        attributes: ['id','first_name','last_name','email'] }],
      order:  [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// PARÁMETROS / STATS DEL SISTEMA
// ═══════════════════════════════════════════════════════════════

const getSystemStats = async (req, res, next) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM works       WHERE company_id = :cid) AS total_works,
        (SELECT COUNT(*) FROM works       WHERE company_id = :cid AND status = 'ACTIVE') AS active_works,
        (SELECT COUNT(*) FROM projects    WHERE company_id = :cid) AS total_projects,
        (SELECT COUNT(*) FROM clients     WHERE company_id = :cid AND is_active = true) AS total_clients,
        (SELECT COUNT(*) FROM suppliers   WHERE company_id = :cid AND is_active = true) AS total_suppliers,
        (SELECT COUNT(*) FROM users       WHERE company_id = :cid AND is_active = true) AS total_users,
        (SELECT COUNT(*) FROM products    WHERE company_id = :cid AND is_active = true) AS total_products,
        (SELECT COUNT(*) FROM catalog_rubros WHERE company_id = :cid AND is_active = true) AS total_rubros,
        (SELECT COALESCE(SUM(amount),0) FROM financial_transactions WHERE company_id = :cid AND type = 'INCOME') AS total_income,
        (SELECT COALESCE(SUM(amount),0) FROM financial_transactions WHERE company_id = :cid AND type = 'EXPENSE') AS total_expense
    `, { replacements: { cid: req.company_id }, type: QueryTypes.SELECT });

    return success(res, rows[0]);
  } catch (err) { next(err); }
};

module.exports = {
  getCompany, updateCompany,
  getUsers, createUser, updateUser, toggleUser, getRoles,
  getAuditLog,
  getSystemStats,
};
