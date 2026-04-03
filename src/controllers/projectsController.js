const { Op } = require('sequelize');
const { sequelize } = require('../models');
const {
  Project, Proforma, ProformaItem, Contract,
  ContractAddendum, ProjectLiquidation, Client, User, Work,
} = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError }  = require('../middlewares/errorHandler');
const { calculateBudget } = require('../utils/budgetCalculator');

// ═══════════════════════════════════════════════════════════════
// PROYECTOS
// ═══════════════════════════════════════════════════════════════

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const where = { company_id: req.company_id };
    if (status) where.status = status;
    if (search) where.name   = { [Op.iLike]: `%${search}%` };

    const { rows, count } = await Project.findAndCountAll({
      where,
      include: [
        { model: Client, as: 'client', attributes: ['id','name'] },
        { model: User,   as: 'assignedUser', attributes: ['id','first_name','last_name'] },
      ],
      order:  [['created_at', 'DESC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [
        { model: Client,             as: 'client' },
        { model: User,               as: 'assignedUser', attributes: ['id','first_name','last_name'] },
        { model: Proforma, as: 'proformas', order: [['version','DESC']],
          include: [{ model: ProformaItem, as: 'items' }] },
        { model: Contract,           as: 'contract',
          include: [{ model: ContractAddendum, as: 'addendums' }] },
        { model: ProjectLiquidation, as: 'liquidation' },
        { model: Work,               as: 'works', attributes: ['id','name','status','actual_progress'] },
      ],
    });
    if (!project) throw createError('Proyecto no encontrado', 404);
    return success(res, project);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const project = await Project.create({ ...req.body, company_id: req.company_id });
    return created(res, project, 'Proyecto creado');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const project = await Project.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!project) throw createError('Proyecto no encontrado', 404);
    await project.update(req.body);
    return success(res, project, 'Proyecto actualizado');
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// PROFORMAS
// ═══════════════════════════════════════════════════════════════

const getProformas = async (req, res, next) => {
  try {
    const proformas = await Proforma.findAll({
      where:   { project_id: req.params.id, company_id: req.company_id },
      include: [{ model: ProformaItem, as: 'items' }],
      order:   [['version', 'DESC']],
    });
    return success(res, proformas);
  } catch (err) { next(err); }
};

const createProforma = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { items = [], utility_pct, contingency_pct, ...proformaData } = req.body;

    // Buscar última versión
    const lastVersion = await Proforma.max('version', {
      where: { project_id: req.params.id }, transaction: t,
    });

    // Calcular totales
    const budget = calculateBudget(items, utility_pct, contingency_pct);

    const proforma = await Proforma.create({
      ...proformaData,
      ...budget,
      project_id:  req.params.id,
      company_id:  req.company_id,
      created_by:  req.user.id,
      version:     (lastVersion || 0) + 1,
      utility_pct:     utility_pct     || 18,
      contingency_pct: contingency_pct || 10,
    }, { transaction: t });

    // Crear items con total calculado
    if (items.length) {
      await ProformaItem.bulkCreate(
        items.map((item, idx) => ({
          ...item,
          proforma_id: proforma.id,
          total: parseFloat(item.quantity) * parseFloat(item.unit_price),
          sort_order: idx,
        })),
        { transaction: t }
      );
    }

    await t.commit();

    const full = await Proforma.findByPk(proforma.id, {
      include: [{ model: ProformaItem, as: 'items' }],
    });
    return created(res, full, 'Proforma creada');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const updateProformaStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const proforma = await Proforma.findOne({
      where: { id: req.params.proformaId, company_id: req.company_id },
    });
    if (!proforma) throw createError('Proforma no encontrada', 404);

    const updates = { status };
    if (status === 'SENT')     updates.sent_at     = new Date();
    if (status === 'APPROVED') updates.approved_at = new Date();

    await proforma.update(updates);

    // Si se aprueba → avanzar proyecto a CONTRACT
    if (status === 'APPROVED') {
      await Project.update(
        { status: 'CONTRACT' },
        { where: { id: proforma.project_id, company_id: req.company_id } }
      );
    }

    return success(res, proforma, `Proforma ${status.toLowerCase()}`);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// CONTRATOS
// ═══════════════════════════════════════════════════════════════

const createContract = async (req, res, next) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, company_id: req.company_id },
    });
    if (!project) throw createError('Proyecto no encontrado', 404);

    // Verificar que no existe contrato activo
    const existing = await Contract.findOne({ where: { project_id: req.params.id } });
    if (existing) throw createError('El proyecto ya tiene un contrato', 409);

    const contract = await Contract.create({
      ...req.body,
      project_id: req.params.id,
      company_id: req.company_id,
      created_by: req.user.id,
    });

    // Actualizar monto contratado en el proyecto
    await project.update({
      contracted_amount: contract.contracted_amount,
      status:            'CONTRACT',
    });

    return created(res, contract, 'Contrato creado');
  } catch (err) { next(err); }
};

const signContract = async (req, res, next) => {
  try {
    const contract = await Contract.findOne({
      where: { project_id: req.params.id, company_id: req.company_id },
    });
    if (!contract) throw createError('Contrato no encontrado', 404);

    const { signed_pdf_url, client_signer_name, client_signer_id } = req.body;

    await contract.update({
      status:             'SIGNED',
      signed_pdf_url,
      client_signer_name,
      client_signer_id,
      client_signed_at:   new Date(),
    });

    // Avanzar proyecto a EXECUTION
    await Project.update(
      { status: 'EXECUTION' },
      { where: { id: req.params.id, company_id: req.company_id } }
    );

    return success(res, contract, 'Contrato firmado. Proyecto en ejecución');
  } catch (err) { next(err); }
};

const addAddendum = async (req, res, next) => {
  try {
    const contract = await Contract.findOne({
      where: { project_id: req.params.id, company_id: req.company_id },
    });
    if (!contract) throw createError('Contrato no encontrado', 404);

    const addendum = await ContractAddendum.create({
      ...req.body,
      contract_id: contract.id,
      company_id:  req.company_id,
    });

    // Actualizar monto final del proyecto sumando el adicional
    await Project.increment('final_amount', {
      by:    parseFloat(addendum.amount),
      where: { id: req.params.id, company_id: req.company_id },
    });

    return created(res, addendum, 'Adicional registrado');
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════════════════════════════
// LIQUIDACIÓN
// ═══════════════════════════════════════════════════════════════

const createLiquidation = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const project = await Project.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{ model: ContractAddendum, as: 'contract',
        include: [{ model: ContractAddendum, as: 'addendums' }] }],
      transaction: t,
    });
    if (!project) throw createError('Proyecto no encontrado', 404);

    // Calcular total final
    const addTotal = req.body.addendums_total || 0;
    const finalAmt = parseFloat(req.body.initial_amount) + parseFloat(addTotal);

    const liquidation = await ProjectLiquidation.create({
      ...req.body,
      project_id:     req.params.id,
      company_id:     req.company_id,
      created_by:     req.user.id,
      final_amount:   finalAmt,
    }, { transaction: t });

    // Actualizar proyecto a LIQUIDATION
    await project.update({
      status:       'LIQUIDATION',
      final_amount: finalAmt,
    }, { transaction: t });

    await t.commit();
    return created(res, liquidation, 'Acta de liquidación creada');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

const signLiquidation = async (req, res, next) => {
  try {
    const liq = await ProjectLiquidation.findOne({
      where: { project_id: req.params.id, company_id: req.company_id },
    });
    if (!liq) throw createError('Liquidación no encontrada', 404);

    const { signed_pdf_url, client_name, client_id_number } = req.body;
    await liq.update({
      signed_pdf_url,
      client_name,
      client_id_number,
      signed_at: new Date(),
    });

    // Cerrar proyecto
    await Project.update(
      { status: 'CLOSED' },
      { where: { id: req.params.id, company_id: req.company_id } }
    );

    return success(res, liq, 'Proyecto cerrado exitosamente');
  } catch (err) { next(err); }
};

const getCounts = async (req, res, next) => {
  try {
    const { QueryTypes } = require('sequelize');
    const rows = await sequelize.query(`
      SELECT status, COUNT(*) as count
      FROM projects
      WHERE company_id = :company_id
      GROUP BY status
    `, { replacements: { company_id: req.company_id }, type: QueryTypes.SELECT });

    // Convertir array a objeto { PROFORMA: 2, CONTRACT: 1, ... }
    const counts = rows.reduce((acc, r) => {
      acc[r.status] = parseInt(r.count);
      return acc;
    }, {});

    return success(res, counts);
  } catch (err) { next(err); }
};

module.exports = {
  getAll, getOne, create, update, getCounts,
  getProformas, createProforma, updateProformaStatus,
  createContract, signContract, addAddendum,
  createLiquidation, signLiquidation,
};
