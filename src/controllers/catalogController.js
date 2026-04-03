const { Op }        = require('sequelize');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { CatalogRubro, RubroCategory } = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError } = require('../middlewares/errorHandler');

// ── CATEGORÍAS ────────────────────────────────────────────────

const getCategories = async (req, res, next) => {
  try {
    const cats = await RubroCategory.findAll({
      where:   { company_id: req.company_id },
      include: [{ model: CatalogRubro, as: 'rubros',
        where: { is_active: true }, required: false }],
      order: [['name', 'ASC']],
    });
    return success(res, cats);
  } catch (err) { next(err); }
};

const createCategory = async (req, res, next) => {
  try {
    const cat = await RubroCategory.create({ ...req.body, company_id: req.company_id });
    return created(res, cat, 'Categoría creada');
  } catch (err) { next(err); }
};

const updateCategory = async (req, res, next) => {
  try {
    const cat = await RubroCategory.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!cat) throw createError('Categoría no encontrada', 404);
    await cat.update(req.body);
    return success(res, cat, 'Categoría actualizada');
  } catch (err) { next(err); }
};

const deleteCategory = async (req, res, next) => {
  try {
    const cat = await RubroCategory.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!cat) throw createError('Categoría no encontrada', 404);
    // Verificar que no tenga rubros
    const count = await CatalogRubro.count({ where: { category_id: cat.id, is_active: true } });
    if (count > 0) throw createError(`No se puede eliminar: tiene ${count} rubro(s) activo(s)`, 400);
    await cat.destroy();
    return success(res, { id: cat.id }, 'Categoría eliminada');
  } catch (err) { next(err); }
};

// ── RUBROS ────────────────────────────────────────────────────

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, category_id } = req.query;
    const where = { company_id: req.company_id, is_active: true };
    if (category_id) where.category_id = category_id;
    if (search) where[Op.or] = [
      { name:        { [Op.iLike]: `%${search}%` } },
      { code:        { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];

    const { rows, count } = await CatalogRubro.findAndCountAll({
      where,
      include: [{ model: RubroCategory, as: 'category', attributes: ['id','name','color'] }],
      order:   [['name', 'ASC']],
      limit:   parseInt(limit),
      offset:  (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const rubro = await CatalogRubro.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{ model: RubroCategory, as: 'category' }],
    });
    if (!rubro) throw createError('Rubro no encontrado', 404);
    return success(res, rubro);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const rubro = await CatalogRubro.create({ ...req.body, company_id: req.company_id });
    return created(res, rubro, 'Rubro creado en catálogo');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const rubro = await CatalogRubro.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!rubro) throw createError('Rubro no encontrado', 404);
    await rubro.update(req.body);
    return success(res, rubro, 'Rubro actualizado');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const rubro = await CatalogRubro.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!rubro) throw createError('Rubro no encontrado', 404);
    await rubro.update({ is_active: false });
    return success(res, { id: rubro.id }, 'Rubro desactivado');
  } catch (err) { next(err); }
};

// ── STATS ─────────────────────────────────────────────────────
const getStats = async (req, res, next) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        rc.id, rc.name, rc.color,
        COUNT(cr.id) FILTER (WHERE cr.is_active = true) AS rubro_count,
        AVG(cr.reference_price) FILTER (WHERE cr.is_active = true) AS avg_price
      FROM rubro_categories rc
      LEFT JOIN catalog_rubros cr ON cr.category_id = rc.id AND cr.company_id = rc.company_id
      WHERE rc.company_id = :company_id
      GROUP BY rc.id, rc.name, rc.color
      ORDER BY rubro_count DESC
    `, { replacements: { company_id: req.company_id }, type: QueryTypes.SELECT });
    return success(res, rows);
  } catch (err) { next(err); }
};

module.exports = {
  getCategories, createCategory, updateCategory, deleteCategory,
  getAll, getOne, create, update, remove, getStats,
};
