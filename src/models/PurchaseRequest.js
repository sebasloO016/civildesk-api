const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseRequest = sequelize.define('PurchaseRequest', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:     { type: DataTypes.INTEGER, allowNull: false },
  work_id:        { type: DataTypes.INTEGER },
  created_by:     { type: DataTypes.INTEGER, allowNull: false },
  request_number: { type: DataTypes.STRING(50) },
  status:         {
    type: DataTypes.STRING(20), defaultValue: 'DRAFT',
    validate: { isIn: [['DRAFT','QUOTED','APPROVED','ORDERED','RECEIVED','CANCELLED']] },
  },
  notes:          { type: DataTypes.TEXT },
}, { tableName: 'purchase_requests' });

module.exports = PurchaseRequest;
