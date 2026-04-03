const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PriceHistory = sequelize.define('PriceHistory', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:    { type: DataTypes.INTEGER, allowNull: false },
  supplier_id:   { type: DataTypes.INTEGER, allowNull: false },
  product_id:    { type: DataTypes.INTEGER, allowNull: false },
  old_price:     { type: DataTypes.DECIMAL(12,2) },
  new_price:     { type: DataTypes.DECIMAL(12,2), allowNull: false },
  variation_pct: { type: DataTypes.DECIMAL(6,2) },
  recorded_by:   { type: DataTypes.INTEGER },
  recorded_at:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'product_price_history', timestamps: false });

module.exports = PriceHistory;
