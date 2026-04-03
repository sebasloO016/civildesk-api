const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Subcontract = sequelize.define('Subcontract', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:        { type: DataTypes.INTEGER, allowNull: false },
  work_id:           { type: DataTypes.INTEGER, allowNull: false },
  supplier_id:       { type: DataTypes.INTEGER, allowNull: false },
  specialty:         { type: DataTypes.STRING(150), allowNull: false },
  description:       { type: DataTypes.TEXT },
  contracted_amount: { type: DataTypes.DECIMAL(14,2), allowNull: false },
  paid_amount:       { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  progress_pct:      { type: DataTypes.DECIMAL(5,2),  defaultValue: 0 },
  start_date:        { type: DataTypes.DATEONLY },
  end_date:          { type: DataTypes.DATEONLY },
  status:            {
    type: DataTypes.STRING(20), defaultValue: 'ACTIVE',
    validate: { isIn: [['ACTIVE','PAUSED','COMPLETED','CANCELLED']] },
  },
  document_url:      { type: DataTypes.STRING(500) },
  notes:             { type: DataTypes.TEXT },
}, { tableName: 'subcontracts' });

module.exports = Subcontract;
