const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ContractAddendum = sequelize.define('ContractAddendum', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:   { type: DataTypes.INTEGER, allowNull: false },
  contract_id:  { type: DataTypes.INTEGER, allowNull: false },
  description:  { type: DataTypes.STRING(300), allowNull: false },
  amount:       { type: DataTypes.DECIMAL(14,2), allowNull: false },
  approved_at:  { type: DataTypes.DATEONLY },
  document_url: { type: DataTypes.STRING(500) },
}, { tableName: 'contract_addendums', updatedAt: false });

module.exports = ContractAddendum;
