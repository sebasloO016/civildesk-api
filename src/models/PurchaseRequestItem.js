const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseRequestItem = sequelize.define('PurchaseRequestItem', {
  id:                   { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  purchase_request_id:  { type: DataTypes.INTEGER, allowNull: false },
  product_id:           { type: DataTypes.INTEGER },
  supplier_id:          { type: DataTypes.INTEGER },
  description:          { type: DataTypes.STRING(300), allowNull: false },
  quantity:             { type: DataTypes.DECIMAL(12,3), allowNull: false },
  unit:                 { type: DataTypes.STRING(30) },
  reference_price:      { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  quoted_price:         { type: DataTypes.DECIMAL(12,2) },
  variation_pct:        { type: DataTypes.DECIMAL(6,2) },
  notes:                { type: DataTypes.TEXT },
}, { tableName: 'purchase_request_items', timestamps: false });

module.exports = PurchaseRequestItem;
