const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Warehouse = sequelize.define('Warehouse', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:  { type: DataTypes.INTEGER, allowNull: false },
  work_id:     { type: DataTypes.INTEGER },
  name:        { type: DataTypes.STRING(150), allowNull: false },
  type:        {
    type: DataTypes.STRING(20), allowNull: false,
    validate: { isIn: [['GENERAL','OBRA']] },
  },
  description: { type: DataTypes.TEXT },
  is_active:   { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'warehouses', updatedAt: false });

module.exports = Warehouse;
