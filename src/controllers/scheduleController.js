const { Op } = require('sequelize');
const { ScheduleTask } = require('../models');
const { success, created } = require('../utils/response');
const { createError }      = require('../middlewares/errorHandler');

const getAll = async (req, res, next) => {
  try {
    const tasks = await ScheduleTask.findAll({
      where: { work_id: req.params.workId, company_id: req.company_id },
      order: [['planned_start', 'ASC']],
    });
    return success(res, tasks);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const task = await ScheduleTask.create({
      ...req.body,
      work_id:    req.params.workId,
      company_id: req.company_id,
    });
    return created(res, task, 'Actividad creada');
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const task = await ScheduleTask.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
    });
    if (!task) throw createError('Actividad no encontrada', 404);
    await task.update(req.body);
    return success(res, task, 'Actividad actualizada');
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const task = await ScheduleTask.findOne({
      where: { id: req.params.id, work_id: req.params.workId, company_id: req.company_id },
    });
    if (!task) throw createError('Actividad no encontrada', 404);
    await task.destroy();
    return success(res, { id: task.id }, 'Actividad eliminada');
  } catch (err) { next(err); }
};

module.exports = { getAll, create, update, remove };
