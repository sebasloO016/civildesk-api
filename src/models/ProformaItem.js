const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProformaItem = sequelize.define('ProformaItem', {
  id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  proforma_id:      { type: DataTypes.INTEGER, allowNull: false },
  catalog_rubro_id: { type: DataTypes.INTEGER },
  category_id:      { type: DataTypes.INTEGER },
  description:      { type: DataTypes.STRING(300), allowNull: false },
  unit:             { type: DataTypes.STRING(30),  allowNull: false },
  quantity:         { type: DataTypes.DECIMAL(12,3), allowNull: false },
  unit_price:       { type: DataTypes.DECIMAL(12,2), allowNull: false },
  total:            { type: DataTypes.DECIMAL(14,2), set() {} },  // GENERATED ALWAYS AS (quantity * unit_price) STORED
  sort_order:       { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'proforma_items', timestamps: false });

module.exports = ProformaItem;
