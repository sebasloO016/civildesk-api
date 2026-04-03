const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id:                   { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:           { type: DataTypes.INTEGER, allowNull: false },
  purchase_request_id:  { type: DataTypes.INTEGER },
  work_id:              { type: DataTypes.INTEGER },
  supplier_id:          { type: DataTypes.INTEGER, allowNull: false },
  created_by:           { type: DataTypes.INTEGER, allowNull: false },
  order_number:         { type: DataTypes.STRING(50) },
  status:               {
    type: DataTypes.STRING(20), defaultValue: 'DRAFT',
    validate: { isIn: [['DRAFT','SENT','CONFIRMED','RECEIVED','CANCELLED']] },
  },
  subtotal:             { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  tax_pct:              { type: DataTypes.DECIMAL(5,2),  defaultValue: 12.00 },
  tax_amount:           { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  total:                { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  expected_date:        { type: DataTypes.DATEONLY },
  request_pdf_url:      { type: DataTypes.STRING(500) },
  proforma_pdf_url:     { type: DataTypes.STRING(500) },
  order_pdf_url:        { type: DataTypes.STRING(500) },
  notes:                { type: DataTypes.TEXT },
  sent_at:              { type: DataTypes.DATE },
  confirmed_at:         { type: DataTypes.DATE },
  received_at:          { type: DataTypes.DATE },
}, { tableName: 'purchase_orders' });

module.exports = PurchaseOrder;
