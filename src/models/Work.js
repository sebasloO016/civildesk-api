const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Work = sequelize.define('Work', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:       { type: DataTypes.INTEGER, allowNull: false },
  project_id:       { type: DataTypes.INTEGER },
  client_id:        { type: DataTypes.INTEGER },
  assigned_user_id: { type: DataTypes.INTEGER },
  name:             { type: DataTypes.STRING(200), allowNull: false },
  description:      { type: DataTypes.TEXT },
  location:         { type: DataTypes.TEXT },
  status:           {
    type: DataTypes.STRING(20), defaultValue: 'ACTIVE',
    validate: { isIn: [['ACTIVE','PAUSED','FINISHED','LIQUIDATION','CLOSED']] },
  },
  start_date:       { type: DataTypes.DATEONLY },
  estimated_end:    { type: DataTypes.DATEONLY },
  actual_end:       { type: DataTypes.DATEONLY },
  utility_pct:          { type: DataTypes.DECIMAL(5,2),  defaultValue: 18.00 },
  contingency_pct:      { type: DataTypes.DECIMAL(5,2),  defaultValue: 10.00 },
  initial_budget:       { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  real_cost:            { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  final_budget:         { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  planned_progress:     { type: DataTypes.DECIMAL(5,2),  defaultValue: 0 },
  actual_progress:      { type: DataTypes.DECIMAL(5,2),  defaultValue: 0 },
  notes:            { type: DataTypes.TEXT },
}, { tableName: 'works' });

module.exports = Work;
