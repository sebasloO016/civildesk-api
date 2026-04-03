const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefreshToken = sequelize.define('RefreshToken', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id:    { type: DataTypes.INTEGER, allowNull: false },
  token:      { type: DataTypes.STRING(500), allowNull: false, unique: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
}, { tableName: 'refresh_tokens', updatedAt: false });

module.exports = RefreshToken;
