const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WarehouseItem = sequelize.define('WarehouseItem', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:        { type: DataTypes.INTEGER, allowNull: false },
  warehouse_id:      { type: DataTypes.INTEGER, allowNull: false },
  product_id:        { type: DataTypes.INTEGER, allowNull: false },
  quantity:          { type: DataTypes.DECIMAL(12,3), defaultValue: 0 },
  reserved_quantity: { type: DataTypes.DECIMAL(12,3), defaultValue: 0 }, // v2.0
  unit:              { type: DataTypes.STRING(30) },
  average_cost:      { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  min_stock:         { type: DataTypes.DECIMAL(12,3), defaultValue: 0 },
  last_movement:     { type: DataTypes.DATE },
}, {
  tableName: 'warehouse_items',
  indexes: [{ unique: true, fields: ['warehouse_id', 'product_id'] }],
  // available_quantity = quantity - reserved_quantity  (calculado en app/vista)
});

// Virtual para disponibilidad real
WarehouseItem.prototype.getAvailable = function () {
  return parseFloat(this.quantity) - parseFloat(this.reserved_quantity);
};

module.exports = WarehouseItem;
