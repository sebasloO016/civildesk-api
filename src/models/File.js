const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const File = sequelize.define('File', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:   { type: DataTypes.INTEGER, allowNull: false },
  uploaded_by:  { type: DataTypes.INTEGER, allowNull: false },
  entity_type:  { type: DataTypes.STRING(50), allowNull: false },
  entity_id:    { type: DataTypes.INTEGER,    allowNull: false },
  file_name:    { type: DataTypes.STRING(300), allowNull: false },
  file_type:    { type: DataTypes.STRING(100) },
  file_size:    { type: DataTypes.INTEGER },
  url:          { type: DataTypes.STRING(500), allowNull: false },
  description:  { type: DataTypes.STRING(300) },
}, { tableName: 'files', updatedAt: false });

module.exports = File;
