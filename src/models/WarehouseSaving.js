const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WarehouseSaving = sequelize.define('WarehouseSaving', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:      { type: DataTypes.INTEGER, allowNull: false },
  work_id:         { type: DataTypes.INTEGER, allowNull: false },
  product_id:      { type: DataTypes.INTEGER, allowNull: false },
  movement_id:     { type: DataTypes.INTEGER, allowNull: false },
  quantity:        { type: DataTypes.DECIMAL(12,3), allowNull: false },
  reference_price: { type: DataTypes.DECIMAL(12,2), allowNull: false },
  actual_cost:     { type: DataTypes.DECIMAL(12,2), allowNull: false },
  saved_amount:    { type: DataTypes.DECIMAL(14,2), allowNull: false },
  saving_date:     { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
}, { tableName: 'warehouse_savings', updatedAt: false });

module.exports = WarehouseSaving;
