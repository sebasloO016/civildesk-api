const { Op }               = require('sequelize');
const { Client, Project, Work } = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError } = require('../middlewares/errorHandler');

// ── GET /clients ──────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const where = { company_id: req.company_id };
    if (search) where[Op.or] = [
      { name:       { [Op.iLike]: `%${search}%` } },
      { ruc_cedula: { [Op.iLike]: `%${search}%` } },
      { email:      { [Op.iLike]: `%${search}%` } },
    ];

    const { rows, count } = await Client.findAndCountAll({
      where,
      order:  [['name', 'ASC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// ── GET /clients/:id ──────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const client = await Client.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [
        { model: Project, as: 'projects',
          attributes: ['id','name','status','contracted_amount'], required: false },
        { model: Work,    as: 'works',
          attributes: ['id','name','status','initial_budget','actual_progress'], required: false },
      ],
    });
    if (!client) throw createError('Cliente no encontrado', 404);
    return success(res, client);
  } catch (err) { next(err); }
};

// ── POST /clients ─────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const client = await Client.create({ ...req.body, company_id: req.company_id });
    return created(res, client, 'Cliente creado');
  } catch (err) { next(err); }
};

// ── PUT /clients/:id ──────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!client) throw createError('Cliente no encontrado', 404);
    await client.update(req.body);
    return success(res, client, 'Cliente actualizado');
  } catch (err) { next(err); }
};

// ── DELETE /clients/:id ───────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const client = await Client.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!client) throw createError('Cliente no encontrado', 404);
    await client.update({ is_active: false });
    return success(res, { id: client.id }, 'Cliente desactivado');
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };
