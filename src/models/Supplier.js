const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Supplier = sequelize.define('Supplier', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:   { type: DataTypes.INTEGER, allowNull: false },
  name:         { type: DataTypes.STRING(200), allowNull: false },
  ruc:          { type: DataTypes.STRING(20) },
  contact_name: { type: DataTypes.STRING(150) },
  phone:        { type: DataTypes.STRING(30) },
  email:        { type: DataTypes.STRING(150) },
  address:      { type: DataTypes.TEXT },
  city:         { type: DataTypes.STRING(100) },
  category:     { type: DataTypes.STRING(100) },
  rating:       { type: DataTypes.DECIMAL(3,2), defaultValue: 5.00 },
  is_active:    { type: DataTypes.BOOLEAN, defaultValue: true },
  notes:        { type: DataTypes.TEXT },
}, { tableName: 'suppliers' });

module.exports = Supplier;
