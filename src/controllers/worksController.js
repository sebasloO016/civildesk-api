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

    // Presupuesto inicial al cliente:
    // Se calcula sobre unit_cost (costo proveedor) aplicando utilidad e imprevistos.
    // Si unit_cost no está definido, se usa unit_price como fallback.
    const initialBudget = calculateBudget(
      items.map(i => ({ quantity: i.initial_qty, unit_price: parseFloat(i.unit_cost || i.unit_price || 0) })),
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

    // Avance combinado (rubros + subcontratos ponderado por costo)
    const progress = await calcCombinedProgress(work.id, req.company_id);

    // Burn rate
    const burn = budgetBurnRate(realCost, initialBudget.total, progress);

    // Datos del contrato/proyecto vinculado (para panel de rentabilidad)
    let contractData = null;
    if (work.project_id) {
      const projectRows = await sequelize.query(`
        SELECT
          p.contracted_amount,
          p.final_amount,
          COALESCE(
            (SELECT SUM(ca.amount) FROM contract_addendums ca
             JOIN contracts c ON c.id = ca.contract_id
             WHERE c.project_id = p.id), 0
          ) AS addendums_total
        FROM projects p
        WHERE p.id = :pid AND p.company_id = :cid
      `, {
        replacements: { pid: work.project_id, cid: req.company_id },
        type: QueryTypes.SELECT,
      });
      if (projectRows.length) {
        const pr = projectRows[0];
        contractData = {
          contracted_amount: parseFloat(pr.contracted_amount || 0),
          addendums_total:   parseFloat(pr.addendums_total   || 0),
          total_to_bill:     parseFloat(pr.contracted_amount || 0) + parseFloat(pr.addendums_total || 0),
        };
      }
    }

    return success(res, {
      initial_budget:    initialBudget,
      real_cost:         realCost,
      actual_progress:   progress,
      warehouse_savings: parseFloat(savings.total),
      burn_rate:         burn,
      items_count:       items.length,
      contract:          contractData,
    });
  } catch (err) { next(err); }
};

// ── Helper: calcular avance combinado rubros + subcontratos ───
const calcCombinedProgress = async (workId, companyId, manualOverride = null) => {
  // Si hay override manual, usarlo directamente
  if (manualOverride !== null && manualOverride !== undefined) {
    return parseFloat(manualOverride);
  }

  const { Subcontract } = require('../models');

  // Avance de rubros propios (ponderado por costo)
  const items = await WorkItem.findAll({ where: { work_id: workId } });
  const rubroProgress = calculateWeightedProgress(items);
  const rubroBudget   = items.reduce((s, i) =>
    s + (parseFloat(i.initial_qty || 0) * parseFloat(i.unit_cost || i.unit_price || 0)), 0);

  // Avance de subcontratos (promedio ponderado por monto contratado)
  const subs = await Subcontract.findAll({
    where: { work_id: workId, company_id: companyId, status: { [require('sequelize').Op.ne]: 'CANCELLED' } },
  });
  const subTotal    = subs.reduce((s, sc) => s + parseFloat(sc.contracted_amount || 0), 0);
  const subProgress = subTotal > 0
    ? subs.reduce((s, sc) => s + (parseFloat(sc.progress_pct || 0) * parseFloat(sc.contracted_amount || 0)), 0) / subTotal
    : 0;

  const totalBudget = rubroBudget + subTotal;
  if (totalBudget === 0) return 0;

  // Avance ponderado combinado
  const combined = (rubroProgress * rubroBudget + subProgress * subTotal) / totalBudget;
  return Math.round(combined * 100) / 100;
};

// ── POST /works/:id/progress ───────────────────────────────────
const updateProgress = async (req, res, next) => {
  try {
    const work = await Work.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{ model: WorkItem, as: 'items' }],
    });
    if (!work) throw createError('Obra no encontrada', 404);

    const { items, manual_override } = req.body;

    // Actualizar progress_pct en los items que vienen en el body
    if (items?.length) {
      for (const item of items) {
        await WorkItem.update(
          { progress_pct: item.progress_pct },
          { where: { id: item.id, work_id: work.id } }
        );
      }
    }

    // Recalcular costos desde items
    const allItems = await WorkItem.findAll({ where: { work_id: work.id } });
    const realCost = allItems.reduce((sum, i) => sum + parseFloat(i.real_total || 0), 0);
    const newBudget = calculateBudget(
      allItems.map(i => ({ quantity: i.initial_qty, unit_price: parseFloat(i.unit_cost || i.unit_price || 0) })),
      work.utility_pct, work.contingency_pct
    );

    // Calcular avance combinado (rubros + subcontratos) o usar override manual
    const newProgress = await calcCombinedProgress(work.id, req.company_id, manual_override);

    await work.update({
      actual_progress: newProgress,
      real_cost:       realCost,
      initial_budget:  newBudget.total,
    });

    // Guardar snapshot para Curva S
    await ProgressSnapshot.create({
      company_id:       req.company_id,
      work_id:          work.id,
      snapshot_date:    new Date(),
      planned_progress: work.planned_progress,
      actual_progress:  newProgress,
      planned_cost:     newBudget.total,
      actual_cost:      realCost,
      recorded_by:      req.user.id,
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
// Crea una obra vinculada a un proyecto.
// NO importa rubros automáticamente — el ingeniero los agrega manualmente.
// El initial_budget arranca en 0 y se recalcula al agregar rubros.
const createFromProject = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { projectId } = req.params;

    // 1. Cargar el proyecto
    const project = await Project.findOne({
      where: { id: projectId, company_id: req.company_id },
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

    // 2. Obtener utility/contingency de la proforma aprobada si existe
    const proforma = await Proforma.findOne({
      where:   { project_id: projectId, status: 'APPROVED' },
      order:   [['version', 'DESC']],
      transaction: t,
    });

    // 3. Crear la obra con presupuesto inicial en 0 (el ing. agrega sus rubros)
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
      initial_budget:   0,   // se recalcula al agregar rubros
      real_cost:        0,
      planned_progress: 0,
      actual_progress:  0,
    }, { transaction: t });

    // 4. Crear almacén de obra
    await inventoryService.createWorkWarehouse(req.company_id, work.id, work.name, t);

    await t.commit();

    const full = await Work.findByPk(work.id, {
      include: [
        { model: Client,   as: 'client' },
        { model: WorkItem, as: 'items'  },
      ],
    });

    return created(res, full, 'Obra creada desde proyecto. Agrega los rubros de presupuesto en la pestaña Presupuesto.');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ══════════════════════════════════════════════════════════════
// CRUD RUBROS DE OBRA (work_items)
// ══════════════════════════════════════════════════════════════

// ── GET /works/:id/items ───────────────────────────────────────
const getItems = async (req, res, next) => {
  try {
    const items = await WorkItem.findAll({
      where: { work_id: req.params.id, company_id: req.company_id },
      order: [['sort_order', 'ASC'], ['created_at', 'ASC']],
    });
    return success(res, items);
  } catch (err) { next(err); }
};

// ── POST /works/:id/items ──────────────────────────────────────
const createItem = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const work = await Work.findOne({ where: { id: req.params.id, company_id: req.company_id }, transaction: t });
    if (!work) throw createError('Obra no encontrada', 404);

    const {
      description, unit, initial_qty, unit_cost, unit_price,
      catalog_rubro_id, sort_order,
    } = req.body;

    if (!description) throw createError('Descripción del rubro requerida', 400);
    if (!unit)        throw createError('Unidad requerida', 400);

    const qty  = parseFloat(initial_qty || 0);
    const cost = parseFloat(unit_cost   || 0);
    // Calcular precio al cliente aplicando utilidad e imprevistos sobre el costo
    const { costToPrice } = require('../utils/budgetCalculator');
    const price = parseFloat(unit_price || costToPrice(cost, work.utility_pct, work.contingency_pct));

    const item = await WorkItem.create({
      company_id:       req.company_id,
      work_id:          work.id,
      catalog_rubro_id: catalog_rubro_id || null,
      description,
      unit,
      initial_qty:    qty,
      real_qty:       0,
      unit_cost:      cost,
      unit_price:     price,
      initial_total:  qty * price,
      real_total:     0,
      progress_pct:   0,
      sort_order:     sort_order ?? 0,
    }, { transaction: t });

    // Recalcular initial_budget de la obra
    const allItems = await WorkItem.findAll({ where: { work_id: work.id }, transaction: t });
    const newBudget = calculateBudget(
      allItems.map(i => ({ quantity: i.initial_qty, unit_price: parseFloat(i.unit_cost || i.unit_price || 0) })),
      work.utility_pct, work.contingency_pct
    );
    await work.update({ initial_budget: newBudget.total }, { transaction: t });

    await t.commit();
    return created(res, item, 'Rubro agregado');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ── PUT /works/:id/items/:itemId ───────────────────────────────
const updateItem = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const work = await Work.findOne({ where: { id: req.params.id, company_id: req.company_id }, transaction: t });
    if (!work) throw createError('Obra no encontrada', 404);

    const item = await WorkItem.findOne({
      where: { id: req.params.itemId, work_id: work.id, company_id: req.company_id },
      transaction: t,
    });
    if (!item) throw createError('Rubro no encontrado', 404);

    const {
      description, unit, initial_qty, unit_cost, unit_price,
      real_qty, progress_pct, sort_order,
    } = req.body;

    const qty  = parseFloat(initial_qty ?? item.initial_qty);
    const cost = parseFloat(unit_cost   ?? item.unit_cost);
    // Recalcular precio cliente si cambió el costo (a menos que venga explícito)
    const { costToPrice: costToPrice2 } = require('../utils/budgetCalculator');
    const price = parseFloat(unit_price ?? costToPrice2(cost, work.utility_pct, work.contingency_pct));
    const rQty  = parseFloat(real_qty ?? item.real_qty);

    await item.update({
      description:   description ?? item.description,
      unit:          unit        ?? item.unit,
      initial_qty:   qty,
      unit_cost:     cost,
      unit_price:    price,
      initial_total: qty * price,
      real_qty:      rQty,
      real_total:    rQty * cost,
      progress_pct:  parseFloat(progress_pct ?? item.progress_pct),
      sort_order:    sort_order ?? item.sort_order,
    }, { transaction: t });

    // Recalcular initial_budget y real_cost de la obra
    const allItems = await WorkItem.findAll({ where: { work_id: work.id }, transaction: t });
    const newBudget = calculateBudget(
      allItems.map(i => ({ quantity: i.initial_qty, unit_price: parseFloat(i.unit_cost || i.unit_price || 0) })),
      work.utility_pct, work.contingency_pct
    );
    const newRealCost = allItems.reduce((s, i) => s + parseFloat(i.real_total || 0), 0);
    const newProgress = calculateWeightedProgress(allItems);

    await work.update({
      initial_budget:  newBudget.total,
      real_cost:       newRealCost,
      actual_progress: newProgress,
    }, { transaction: t });

    await t.commit();
    return success(res, item, 'Rubro actualizado');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ── DELETE /works/:id/items/:itemId ───────────────────────────
const deleteItem = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const work = await Work.findOne({ where: { id: req.params.id, company_id: req.company_id }, transaction: t });
    if (!work) throw createError('Obra no encontrada', 404);

    const item = await WorkItem.findOne({
      where: { id: req.params.itemId, work_id: work.id, company_id: req.company_id },
      transaction: t,
    });
    if (!item) throw createError('Rubro no encontrado', 404);

    await item.destroy({ transaction: t });

    // Recalcular presupuesto inicial al cliente (costo × márgenes)
    const allItems  = await WorkItem.findAll({ where: { work_id: work.id }, transaction: t });
    const newBudget = calculateBudget(
      allItems.map(i => ({ quantity: i.initial_qty, unit_price: parseFloat(i.unit_cost || i.unit_price || 0) })),
      work.utility_pct, work.contingency_pct
    );
    await work.update({ initial_budget: newBudget.total }, { transaction: t });

    await t.commit();
    return success(res, { id: req.params.itemId }, 'Rubro eliminado');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = {
  getAll, getOne, create, createFromProject, update, remove,
  getBudgetSummary, updateProgress, getCurveS, closeWork,
  // CRUD items
  getItems, createItem, updateItem, deleteItem,
};
