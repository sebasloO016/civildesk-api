const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReportPurchase = sequelize.define('ReportPurchase', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:      { type: DataTypes.INTEGER, allowNull: false },
  daily_report_id: { type: DataTypes.INTEGER, allowNull: false },
  work_id:         { type: DataTypes.INTEGER, allowNull: false },
  supplier_id:     { type: DataTypes.INTEGER },
  product_id:      { type: DataTypes.INTEGER },
  description:     { type: DataTypes.STRING(300), allowNull: false },
  quantity:        { type: DataTypes.DECIMAL(12,3), allowNull: false },
  unit:            { type: DataTypes.STRING(30) },
  unit_price:      { type: DataTypes.DECIMAL(12,2), allowNull: false },
  total:           { type: DataTypes.DECIMAL(14,2), set() {} },  // GENERATED ALWAYS AS (quantity * unit_price) STORED
  category:        { type: DataTypes.STRING(100) },
  invoice_url:     { type: DataTypes.STRING(500) },
  // Columnas de migration_reconciliation.sql
  purchase_invoice_id: { type: DataTypes.INTEGER },
  is_billed:       { type: DataTypes.BOOLEAN, defaultValue: false },
  billed_at:       { type: DataTypes.DATE },
  financial_tx_id: { type: DataTypes.INTEGER },
}, { tableName: 'report_purchases', updatedAt: false });

module.exports = ReportPurchase;
