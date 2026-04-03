const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Client = sequelize.define('Client', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id: { type: DataTypes.INTEGER, allowNull: false },
  name:       { type: DataTypes.STRING(200), allowNull: false },
  ruc_cedula: { type: DataTypes.STRING(20) },
  phone:      { type: DataTypes.STRING(30) },
  email:      { type: DataTypes.STRING(150) },
  address:    { type: DataTypes.TEXT },
  city:       { type: DataTypes.STRING(100) },
  notes:      { type: DataTypes.TEXT },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'clients' });

module.exports = Client;
