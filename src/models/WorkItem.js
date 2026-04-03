const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkItem = sequelize.define('WorkItem', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:       { type: DataTypes.INTEGER, allowNull: false },
  work_id:          { type: DataTypes.INTEGER, allowNull: false },
  catalog_rubro_id: { type: DataTypes.INTEGER },
  category_id:      { type: DataTypes.INTEGER },
  description:      { type: DataTypes.STRING(300), allowNull: false },
  unit:             { type: DataTypes.STRING(30),  allowNull: false },
  initial_qty:      { type: DataTypes.DECIMAL(12,3), defaultValue: 0 },
  real_qty:         { type: DataTypes.DECIMAL(12,3), defaultValue: 0 },
  unit_cost:        { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  unit_price:       { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  initial_total:    { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  real_total:       { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  progress_pct:     { type: DataTypes.DECIMAL(5,2),  defaultValue: 0 },
  sort_order:       { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'work_items' });

module.exports = WorkItem;
