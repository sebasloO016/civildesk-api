// ── Company.js ────────────────────────────────────────────────
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Company = sequelize.define('Company', {
  id:                     { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:                   { type: DataTypes.STRING(150), allowNull: false },
  ruc:                    { type: DataTypes.STRING(20), allowNull: true, unique: true },
  logo_url:               { type: DataTypes.STRING(500), allowNull: true },
  address:                { type: DataTypes.TEXT, allowNull: true },
  phone:                  { type: DataTypes.STRING(30), allowNull: true },
  email:                  { type: DataTypes.STRING(150), allowNull: true },
  city:                   { type: DataTypes.STRING(100), allowNull: true },
  country:                { type: DataTypes.STRING(100), defaultValue: 'Ecuador' },
  default_utility_pct:    { type: DataTypes.DECIMAL(5,2), defaultValue: 18.00 },
  default_contingency_pct:{ type: DataTypes.DECIMAL(5,2), defaultValue: 10.00 },
  price_alert_threshold_pct: { type: DataTypes.DECIMAL(5,2), defaultValue: 10.00 },
  stock_alert_default_min:{ type: DataTypes.DECIMAL(10,2), defaultValue: 5.00 },
  is_active:              { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'companies' });

module.exports = Company;
