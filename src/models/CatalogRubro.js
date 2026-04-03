const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CatalogRubro = sequelize.define('CatalogRubro', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:      { type: DataTypes.INTEGER, allowNull: false },
  category_id:     { type: DataTypes.INTEGER },
  code:            { type: DataTypes.STRING(50) },
  name:            { type: DataTypes.STRING(200), allowNull: false },
  description:     { type: DataTypes.TEXT },
  unit:            { type: DataTypes.STRING(30), allowNull: false },
  reference_price: { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  is_active:       { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'catalog_rubros' });

module.exports = CatalogRubro;
