const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Proforma = sequelize.define('Proforma', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:      { type: DataTypes.INTEGER, allowNull: false },
  project_id:      { type: DataTypes.INTEGER, allowNull: false },
  created_by:      { type: DataTypes.INTEGER, allowNull: false },
  version:         { type: DataTypes.INTEGER, defaultValue: 1 },
  status:          {
    type: DataTypes.STRING(20), defaultValue: 'DRAFT',
    validate: { isIn: [['DRAFT','SENT','APPROVED','REJECTED']] },
  },
  subtotal:        { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  utility_pct:     { type: DataTypes.DECIMAL(5,2),  defaultValue: 18.00 },
  contingency_pct: { type: DataTypes.DECIMAL(5,2),  defaultValue: 10.00 },
  utility_amount:  { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  contingency_amt: { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  total:           { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  notes:           { type: DataTypes.TEXT },
  valid_until:     { type: DataTypes.DATEONLY },
  sent_at:         { type: DataTypes.DATE },
  approved_at:     { type: DataTypes.DATE },
  pdf_url:         { type: DataTypes.STRING(500) },
}, { tableName: 'proformas' });

module.exports = Proforma;
