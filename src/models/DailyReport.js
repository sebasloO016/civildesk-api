const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DailyReport = sequelize.define('DailyReport', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:   { type: DataTypes.INTEGER, allowNull: false },
  work_id:      { type: DataTypes.INTEGER, allowNull: false },
  created_by:   { type: DataTypes.INTEGER, allowNull: false },
  report_date:  { type: DataTypes.DATEONLY, allowNull: false },
  weather:      { type: DataTypes.STRING(50) },
  activities:   { type: DataTypes.TEXT, allowNull: false },
  novelties:    { type: DataTypes.TEXT },
  workers_count:{ type: DataTypes.INTEGER, defaultValue: 0 },
  notes:        { type: DataTypes.TEXT },
}, {
  tableName: 'daily_reports',
  indexes: [{ unique: true, fields: ['work_id', 'report_date'] }],
});

module.exports = DailyReport;
