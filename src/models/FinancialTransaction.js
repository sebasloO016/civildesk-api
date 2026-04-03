const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FinancialTransaction = sequelize.define('FinancialTransaction', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:       { type: DataTypes.INTEGER, allowNull: false },
  work_id:          { type: DataTypes.INTEGER, allowNull: false },
  type:             {
    type: DataTypes.STRING(15), allowNull: false,
    validate: { isIn: [['INCOME','EXPENSE']] },
  },
  category:         { type: DataTypes.STRING(50), allowNull: false },
  description:      { type: DataTypes.STRING(300), allowNull: false },
  amount:           { type: DataTypes.DECIMAL(14,2), allowNull: false },
  transaction_date: { type: DataTypes.DATEONLY, allowNull: false },
  supplier_id:        { type: DataTypes.INTEGER },
  subcontract_id:     { type: DataTypes.INTEGER },
  invoice_id:         { type: DataTypes.INTEGER },
  document_url:       { type: DataTypes.STRING(500) },
  reference:          { type: DataTypes.STRING(100) },
  recorded_by:        { type: DataTypes.INTEGER, allowNull: false },
  notes:              { type: DataTypes.TEXT },
  // Columnas migration_reconciliation.sql
  report_purchase_id: { type: DataTypes.INTEGER },
  is_reconciled:      { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'financial_transactions' });

module.exports = FinancialTransaction;
