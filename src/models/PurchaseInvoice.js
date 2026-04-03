const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseInvoice = sequelize.define('PurchaseInvoice', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:         { type: DataTypes.INTEGER, allowNull: false },
  purchase_order_id:  { type: DataTypes.INTEGER },
  work_id:            { type: DataTypes.INTEGER },
  supplier_id:        { type: DataTypes.INTEGER, allowNull: false },
  invoice_number:     { type: DataTypes.STRING(100), allowNull: false },
  issue_date:         { type: DataTypes.DATEONLY, allowNull: false },
  subtotal:           { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  tax_amount:         { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  total:              { type: DataTypes.DECIMAL(14,2), allowNull: false },
  status:             {
    type: DataTypes.STRING(20), defaultValue: 'PENDING',
    validate: { isIn: [['PENDING','PAID','CANCELLED']] },
  },
  document_url:       { type: DataTypes.STRING(500) },
  payment_date:       { type: DataTypes.DATEONLY },
  notes:              { type: DataTypes.TEXT },
}, { tableName: 'purchase_invoices' });

module.exports = PurchaseInvoice;
