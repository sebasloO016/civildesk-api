const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RubroCategory = sequelize.define('RubroCategory', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:  { type: DataTypes.INTEGER, allowNull: false },
  name:        { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.TEXT },
  color:       { type: DataTypes.STRING(7), defaultValue: '#1A5A8A' },
}, { tableName: 'rubro_categories', updatedAt: false });

module.exports = RubroCategory;
