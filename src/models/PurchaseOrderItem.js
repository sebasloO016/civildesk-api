const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrderItem = sequelize.define('PurchaseOrderItem', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  purchase_order_id:  { type: DataTypes.INTEGER, allowNull: false },
  product_id:         { type: DataTypes.INTEGER },
  description:        { type: DataTypes.STRING(300), allowNull: false },
  quantity:           { type: DataTypes.DECIMAL(12,3), allowNull: false },
  unit:               { type: DataTypes.STRING(30) },
  unit_price:         { type: DataTypes.DECIMAL(12,2), allowNull: false },
  total:              { type: DataTypes.DECIMAL(14,2), set() {} },  // GENERATED ALWAYS AS (quantity * unit_price) STORED
  reference_price:    { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  variation_pct:      { type: DataTypes.DECIMAL(6,2) },
}, { tableName: 'purchase_order_items', timestamps: false });

module.exports = PurchaseOrderItem;
