const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:        { type: DataTypes.INTEGER, allowNull: false },
  client_id:         { type: DataTypes.INTEGER, allowNull: false },
  assigned_user_id:  { type: DataTypes.INTEGER },
  code:              { type: DataTypes.STRING(50) },
  name:              { type: DataTypes.STRING(200), allowNull: false },
  description:       { type: DataTypes.TEXT },
  location:          { type: DataTypes.TEXT },
  status:            {
    type: DataTypes.STRING(30),
    defaultValue: 'PROFORMA',
    validate: { isIn: [['PROFORMA','CONTRACT','EXECUTION','LIQUIDATION','CLOSED']] },
  },
  contracted_amount: { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  final_amount:      { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  started_at:        { type: DataTypes.DATEONLY },
  estimated_end:     { type: DataTypes.DATEONLY },
  actual_end:        { type: DataTypes.DATEONLY },
  notes:             { type: DataTypes.TEXT },
}, { tableName: 'projects' });

module.exports = Project;
