const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReportPhoto = sequelize.define('ReportPhoto', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  daily_report_id: { type: DataTypes.INTEGER, allowNull: false },
  url:             { type: DataTypes.STRING(500), allowNull: false },
  caption:         { type: DataTypes.STRING(300) },
  sort_order:      { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'report_photos', updatedAt: false });

module.exports = ReportPhoto;
