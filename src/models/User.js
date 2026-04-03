const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:    { type: DataTypes.INTEGER, allowNull: false },
  role_id:       { type: DataTypes.INTEGER, allowNull: false },
  first_name:    { type: DataTypes.STRING(100), allowNull: false },
  last_name:     { type: DataTypes.STRING(100), allowNull: false },
  email:         { type: DataTypes.STRING(150), allowNull: false },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  phone:         { type: DataTypes.STRING(30) },
  avatar_url:    { type: DataTypes.STRING(500) },
  is_active:     { type: DataTypes.BOOLEAN, defaultValue: true },
  last_login:    { type: DataTypes.DATE },
}, {
  tableName: 'users',
  indexes: [{ unique: true, fields: ['company_id', 'email'] }],
});

module.exports = User;
