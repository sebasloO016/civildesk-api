const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SupplierProduct = sequelize.define('SupplierProduct', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:   { type: DataTypes.INTEGER, allowNull: false },
  supplier_id:  { type: DataTypes.INTEGER, allowNull: false },
  product_id:   { type: DataTypes.INTEGER, allowNull: false },
  unit_price:   { type: DataTypes.DECIMAL(12,2), allowNull: false },
  last_updated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  notes:        { type: DataTypes.TEXT },
}, {
  tableName:  'supplier_products',
  timestamps: false,                    // sin created_at / updated_at
  indexes: [{ unique: true, fields: ['supplier_id', 'product_id'] }],
});

module.exports = SupplierProduct;
