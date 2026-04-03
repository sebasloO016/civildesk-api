const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define('Role', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:        { type: DataTypes.STRING(50), allowNull: false },
  description: { type: DataTypes.TEXT },
  permissions: { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'roles', updatedAt: false });

module.exports = Role;
