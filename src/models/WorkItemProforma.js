const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkItemProforma = sequelize.define('WorkItemProforma', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:   { type: DataTypes.INTEGER, allowNull: false },
  work_item_id: { type: DataTypes.INTEGER, allowNull: false },
  supplier_id:  { type: DataTypes.INTEGER, allowNull: false },
  unit_price:   { type: DataTypes.DECIMAL(12,2), allowNull: false },
  total:        { type: DataTypes.DECIMAL(14,2) },
  notes:        { type: DataTypes.TEXT },
  document_url: { type: DataTypes.STRING(500) },
  is_selected:  { type: DataTypes.BOOLEAN, defaultValue: false },
  submitted_at: { type: DataTypes.DATEONLY },
}, { tableName: 'work_item_proformas', updatedAt: false });

module.exports = WorkItemProforma;
