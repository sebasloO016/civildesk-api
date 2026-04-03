const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id:          { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  company_id:  { type: DataTypes.INTEGER },
  user_id:     { type: DataTypes.INTEGER },
  table_name:  { type: DataTypes.STRING(100), allowNull: false },
  record_id:   { type: DataTypes.INTEGER,     allowNull: false },
  action:      {
    type: DataTypes.STRING(10), allowNull: false,
    validate: { isIn: [['INSERT','UPDATE','DELETE']] },
  },
  old_values:  { type: DataTypes.JSONB },
  new_values:  { type: DataTypes.JSONB },
  ip_address:  { type: DataTypes.INET },
  user_agent:  { type: DataTypes.TEXT },
}, { tableName: 'audit_logs', updatedAt: false });

module.exports = AuditLog;
