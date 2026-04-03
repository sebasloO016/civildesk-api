const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProjectLiquidation = sequelize.define('ProjectLiquidation', {
  id:                     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:             { type: DataTypes.INTEGER, allowNull: false },
  project_id:             { type: DataTypes.INTEGER, allowNull: false },
  created_by:             { type: DataTypes.INTEGER, allowNull: false },
  initial_amount:         { type: DataTypes.DECIMAL(14,2), allowNull: false },
  addendums_total:        { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  final_amount:           { type: DataTypes.DECIMAL(14,2), allowNull: false },
  client_name:            { type: DataTypes.STRING(150) },
  client_id_number:       { type: DataTypes.STRING(20) },
  signed_at:              { type: DataTypes.DATEONLY },
  liquidation_pdf_url:    { type: DataTypes.STRING(500) },
  signed_pdf_url:         { type: DataTypes.STRING(500) },
  notes:                  { type: DataTypes.TEXT },
}, { tableName: 'project_liquidations' });

module.exports = ProjectLiquidation;
