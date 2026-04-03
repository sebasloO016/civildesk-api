const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduleTask = sequelize.define('ScheduleTask', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:       { type: DataTypes.INTEGER, allowNull: false },
  work_id:          { type: DataTypes.INTEGER, allowNull: false },
  work_item_id:     { type: DataTypes.INTEGER },
  parent_task_id:   { type: DataTypes.INTEGER },
  name:             { type: DataTypes.STRING(200), allowNull: false },
  description:      { type: DataTypes.TEXT },
  planned_start:    { type: DataTypes.DATEONLY, allowNull: false },
  planned_end:      { type: DataTypes.DATEONLY, allowNull: false },
  actual_start:     { type: DataTypes.DATEONLY },
  actual_end:       { type: DataTypes.DATEONLY },
  planned_progress: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
  actual_progress:  { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
  status:           {
    type: DataTypes.STRING(20), defaultValue: 'PENDING',
    validate: { isIn: [['PENDING','IN_PROGRESS','COMPLETED','DELAYED']] },
  },
  sort_order:       { type: DataTypes.INTEGER, defaultValue: 0 },
  color:            { type: DataTypes.STRING(7), defaultValue: '#1A5A8A' },
}, { tableName: 'schedule_tasks' });

module.exports = ScheduleTask;
