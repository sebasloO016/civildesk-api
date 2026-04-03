const { Op }             = require('sequelize');
const { sequelize }      = require('../config/database');
const { QueryTypes }     = require('sequelize');
const {
  Work, WorkItem, DailyReport, FinancialTransaction,
  Client, User, ProgressSnapshot, ScheduleTask,
  Project, Proforma, ProformaItem,
}                        = require('../models');
const { success, created, paginated, error } = require('../utils/response');
const { createError }    = require('../middlewares/errorHandler');
const { calculateBudget, calculateWeightedProgress, budgetBurnRate } = require('../utils/budgetCalculator');
const inventoryService   = require('../services/inventory/inventoryService');

// ── GET /works ─────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const where = { company_id: req.company_id };

    if (status) where.status = status;
    if (search) where.name   = { [Op.iLike]: `%${search}%` };

    const { rows, count } = await Work.findAndCountAll({
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

// ── GET /works/:id ─────────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const work = await Work.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [
        { model: Client,       as: 'client' },
        { model: User,         as: 'assignedUser', attributes: ['id','first_name','last_name'] },
        { model: WorkItem,     as: 'items', order: [['sort_order','ASC']] },
        { model: ScheduleTask, as: 'scheduleTasks', where: { parent_task_id: null }, required: false,
          include: [{ model: ScheduleTask, as: 'subtasks' }] },
      ],
    });

    if (!work) throw createError('Obra no encontrada', 404);

    // Calcular burn rate
    const burn = budgetBurnRate(work.real_cost, work.initial_budget, work.actual_progress);

    return success(res, { ...work.toJSON(), burn_rate: burn });
  } catch (err) { next(err); }
};

// ── POST /works ────────────────────────────────────────────────
const create = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const work = await Work.create(
      { ...req.body, company_id: req.company_id },
      { transaction: t }
    );

    // Crear almacén de obra automáticamente
    await inventoryService.createWorkWarehouse(req.company_id, work.id, work.name, t);

    await t.commit();
    return created(res, work, 'Obra creada exitosamente');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ── PUT /works/:id ─────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const work = await Work.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!work) throw createError('Obra no encontrada', 404);

    await work.update(req.body);
    return success(res, work, 'Obra actualizada');
  } catch (err) { next(err); }
};

// ── DELETE /works/:id ──────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const work = await Work.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!work) throw createError('Obra no encontrada', 404);
    if (work.status !== 'ACTIVE') throw createError('Solo se puede eliminar obras en estado ACTIVE', 400);

    await work.destroy();
    return success(res, { id: work.id }, 'Obra eliminada');
  } catch (err) { next(err); }
};

// ── GET /works/:id/budget-summary ─────────────────────────────
const getBudgetSummary = async (req, res, next) => {
  try {
    const work = await Work.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{ model: WorkItem, as: 'items' }],
    });
    if (!work) throw createError('Obra no encontrada', 404);

    const items = work.items;

    // Presupuesto inicial (cantidades iniciales * precio cliente)
    const initialBudget = calculateBudget(
      items.map(i => ({ quantity: i.initial_qty, unit_price: i.unit_price })),
      work.utility_pct,
      work.contingency_pct
    );

    // Costo real (cantidades reales * costo proveedor)
    const realCost = items.reduce((sum, i) => sum + parseFloat(i.real_total || 0), 0);

    // Ahorro de bodega
    const [savings] = await sequelize.query(
      `SELECT COALESCE(SUM(saved_amount),0) AS total FROM warehouse_savings WHERE work_id = :wid AND company_id = :cid`,
      { replacements: { wid: work.id, cid: req.company_id }, type: QueryTypes.SELECT }
    );

    // Avance ponderado
    const progress = calculateWeightedProgress(items);

    // Burn rate
    const burn = budgetBurnRate(realCost, initialBudget.total, progress);

    return success(res, {
      initial_budget: initialBudget,
      real_cost:      realCost,
      actual_progress: progress,
      warehouse_savings: parseFloat(savings.total),
      burn_rate:      burn,
      items_count:    items.length,
    });
  } catch (err) { next(err); }
};

// ── POST /works/:id/progress ───────────────────────────────────
const updateProgress = async (req, res, next) => {
  try {
    const work = await Work.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{ model: WorkItem, as: 'items' }],
    });
    if (!work) throw createError('Obra no encontrada', 404);

    // Actualizar progress_pct en los items que vienen en el body
    const { items } = req.body;
    if (items?.length) {
      for (const item of items) {
        await WorkItem.update(
          { progress_pct: item.progress_pct },
          { where: { id: item.id, work_id: work.id } }
        );
      }
    }

    // Recalcular avance general ponderado
    const allItems     = await WorkItem.findAll({ where: { work_id: work.id } });
    const newProgress  = calculateWeightedProgress(allItems);
    const realCost     = allItems.reduce((sum, i) => sum + parseFloat(i.real_total || 0), 0);

    await work.update({ actual_progress: newProgress, real_cost: realCost });

    // Guardar snapshot para Curva S
    await ProgressSnapshot.create({
      company_id:      req.company_id,
      work_id:         work.id,
      snapshot_date:   new Date(),
      planned_progress:work.planned_progress,
      actual_progress: newProgress,
      planned_cost:    work.initial_budget,
      actual_cost:     realCost,
      recorded_by:     req.user.id,
    });

    return success(res, { actual_progress: newProgress, real_cost: realCost }, 'Avance actualizado');
  } catch (err) { next(err); }
};

// ── GET /works/:id/curve-s ─────────────────────────────────────
const getCurveS = async (req, res, next) => {
  try {
    const snapshots = await ProgressSnapshot.findAll({
      where:  { work_id: req.params.id, company_id: req.company_id },
      order:  [['snapshot_date', 'ASC']],
      attributes: ['snapshot_date','planned_progress','actual_progress','planned_cost','actual_cost'],
    });

    return success(res, snapshots);
  } catch (err) { next(err); }
};

// ── POST /works/:id/close  (cierre y traslado de sobrantes) ───
const closeWork = async (req, res, next) => {
  try {
    const work = await Work.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!work) throw createError('Obra no encontrada', 404);

    const { surplus_items = [] } = req.body;

    // Trasladar sobrantes si vienen
    let transferResults = [];
    if (surplus_items.length) {
      transferResults = await inventoryService.transferSurplusToGeneral({
        work_id:    work.id,
        company_id: req.company_id,
        items:      surplus_items,
        created_by: req.user.id,
      });
    }

    await work.update({ status: 'FINISHED', actual_end: new Date() });

    return success(res, { work_id: work.id, transfers: transferResults }, 'Obra cerrada y sobrantes trasladados a bodega');
  } catch (err) { next(err); }
};

// ── POST /works/from-project/:projectId ───────────────────────
// Crea una obra vinculada a un proyecto, importando los rubros
// de la proforma aprobada como WorkItems del presupuesto
const createFromProject = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { projectId } = req.params;

    // 1. Cargar el proyecto con su proforma aprobada
    const project = await Project.findOne({
      where:   { id: projectId, company_id: req.company_id },
      include: [{
        model:   Proforma,
        as:      'proformas',
        where:   { status: 'APPROVED' },
        required: false,
        include: [{ model: ProformaItem, as: 'items' }],
        order:   [['version', 'DESC']],
        limit:   1,
      }],
      transaction: t,
    });

    if (!project) throw createError('Proyecto no encontrado', 404);
    if (project.status !== 'EXECUTION' && project.status !== 'CONTRACT')
      throw createError('El proyecto debe estar en estado Contrato o Ejecución', 400);

    // Verificar que no tenga obra ya vinculada
    const existingWork = await Work.findOne({
      where: { project_id: projectId, company_id: req.company_id },
      transaction: t,
    });
    if (existingWork) throw createError('Este proyecto ya tiene una obra vinculada', 409);

    // 2. Tomar la proforma aprobada (o la más reciente si no hay aprobada)
    let proforma = project.proformas?.[0];
    if (!proforma) {
      proforma = await Proforma.findOne({
        where:   { project_id: projectId },
        include: [{ model: ProformaItem, as: 'items' }],
        order:   [['version', 'DESC']],
        transaction: t,
      });
    }

    // 3. Calcular presupuesto inicial desde el contrato o proforma
    const initialBudget = parseFloat(project.contracted_amount) ||
                          parseFloat(proforma?.total) || 0;

    // 4. Crear la obra
    const { start_date, end_date, assigned_user_id, description } = req.body;
    const work = await Work.create({
      company_id:       req.company_id,
      project_id:       projectId,
      client_id:        project.client_id,
      assigned_user_id: assigned_user_id || req.user.id,
      name:             project.name,
      description:      description || project.description,
      location:         project.location,
      status:           'ACTIVE',
      start_date:       start_date || new Date().toISOString().substring(0, 10),
      estimated_end:    end_date || null,
      utility_pct:      proforma?.utility_pct     || 18,
      contingency_pct:  proforma?.contingency_pct || 10,
      initial_budget:   initialBudget,
      real_cost:        0,
      planned_progress: 0,
      actual_progress:  0,
    }, { transaction: t });

    // 5. Importar ítems de la proforma como WorkItems
    let itemsCreated = 0;
    if (proforma?.items?.length) {
      await WorkItem.bulkCreate(
        proforma.items.map((item, idx) => ({
          company_id:    req.company_id,
          work_id:       work.id,
          description:   item.description,
          unit:          item.unit,
          initial_qty:   parseFloat(item.quantity),
          real_qty:      0,
          unit_cost:     parseFloat(item.unit_price), // precio de costo = precio ofertado (se ajusta en campo)
          unit_price:    parseFloat(item.unit_price), // precio cliente
          initial_total: parseFloat(item.total || item.quantity * item.unit_price),
          real_total:    0,
          progress_pct:  0,
          sort_order:    idx,
          catalog_rubro_id: item.catalog_rubro_id || null,
        })),
        { transaction: t }
      );
      itemsCreated = proforma.items.length;
    }

    // 6. Crear almacén de obra
    await inventoryService.createWorkWarehouse(req.company_id, work.id, work.name, t);

    // 7. (No action needed — works.project_id already set above)
    // The link project→work is queried via works.project_id

    await t.commit();

    const full = await Work.findByPk(work.id, {
      include: [
        { model: Client,   as: 'client' },
        { model: WorkItem, as: 'items'  },
      ],
    });

    return created(res, full,
      `Obra creada desde proyecto con ${itemsCreated} rubros importados del presupuesto`
    );
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = { getAll, getOne, create, createFromProject, update, remove, getBudgetSummary, updateProgress, getCurveS, closeWork };

