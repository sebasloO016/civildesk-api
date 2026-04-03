const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Contract = sequelize.define('Contract', {
  id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:          { type: DataTypes.INTEGER, allowNull: false },
  project_id:          { type: DataTypes.INTEGER, allowNull: false },
  proforma_id:         { type: DataTypes.INTEGER },
  created_by:          { type: DataTypes.INTEGER, allowNull: false },
  contract_number:     { type: DataTypes.STRING(50) },
  status:              {
    type: DataTypes.STRING(20), defaultValue: 'DRAFT',
    validate: { isIn: [['DRAFT','SENT','SIGNED','ACTIVE','CLOSED']] },
  },
  contracted_amount:   { type: DataTypes.DECIMAL(14,2), allowNull: false },
  payment_terms:       { type: DataTypes.TEXT },
  start_date:          { type: DataTypes.DATEONLY },
  end_date:            { type: DataTypes.DATEONLY },
  penalty_clause:      { type: DataTypes.TEXT },
  scope:               { type: DataTypes.TEXT },
  client_signed_at:    { type: DataTypes.DATE },
  client_signer_name:  { type: DataTypes.STRING(150) },
  client_signer_id:    { type: DataTypes.STRING(20) },
  contract_pdf_url:    { type: DataTypes.STRING(500) },
  signed_pdf_url:      { type: DataTypes.STRING(500) },
  notes:               { type: DataTypes.TEXT },
}, { tableName: 'contracts' });

module.exports = Contract;
