const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SubcontractPayment = sequelize.define('SubcontractPayment', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:     { type: DataTypes.INTEGER, allowNull: false },
  subcontract_id: { type: DataTypes.INTEGER, allowNull: false },
  amount:         { type: DataTypes.DECIMAL(14,2), allowNull: false },
  payment_date:   { type: DataTypes.DATEONLY,      allowNull: false },
  payment_method: { type: DataTypes.STRING(50) },
  reference:      { type: DataTypes.STRING(100) },
  notes:          { type: DataTypes.TEXT },
}, { tableName: 'subcontract_payments', updatedAt: false });

module.exports = SubcontractPayment;
