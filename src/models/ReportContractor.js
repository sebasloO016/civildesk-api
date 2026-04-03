const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReportContractor = sequelize.define('ReportContractor', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  daily_report_id: { type: DataTypes.INTEGER, allowNull: false },
  supplier_id:     { type: DataTypes.INTEGER, allowNull: false },
  workers_count:   { type: DataTypes.INTEGER, defaultValue: 1 },
  activity:        { type: DataTypes.STRING(300) },
}, { tableName: 'report_contractors', timestamps: false });

module.exports = ReportContractor;
