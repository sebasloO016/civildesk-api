const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProgressSnapshot = sequelize.define('ProgressSnapshot', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:       { type: DataTypes.INTEGER, allowNull: false },
  work_id:          { type: DataTypes.INTEGER, allowNull: false },
  snapshot_date:    { type: DataTypes.DATEONLY, allowNull: false },
  planned_progress: { type: DataTypes.DECIMAL(5,2),  defaultValue: 0 },
  actual_progress:  { type: DataTypes.DECIMAL(5,2),  defaultValue: 0 },
  planned_cost:     { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  actual_cost:      { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  recorded_by:      { type: DataTypes.INTEGER },
}, { tableName: 'progress_snapshots', updatedAt: false });

module.exports = ProgressSnapshot;
