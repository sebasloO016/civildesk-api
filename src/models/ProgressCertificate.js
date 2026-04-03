const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProgressCertificate = sequelize.define('ProgressCertificate', {
  id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:         { type: DataTypes.INTEGER, allowNull: false },
  work_id:            { type: DataTypes.INTEGER, allowNull: false },
  project_id:         { type: DataTypes.INTEGER },
  created_by:         { type: DataTypes.INTEGER, allowNull: false },
  certificate_number: { type: DataTypes.STRING(50) },
  period:             { type: DataTypes.STRING(50) },
  progress_pct:       { type: DataTypes.DECIMAL(5,2),  allowNull: false },
  amount_to_bill:     { type: DataTypes.DECIMAL(14,2), allowNull: false },
  status:             {
    type: DataTypes.STRING(20), defaultValue: 'DRAFT',
    validate: { isIn: [['DRAFT','SENT','APPROVED','PAID']] },
  },
  pdf_url:            { type: DataTypes.STRING(500) },
  signed_pdf_url:     { type: DataTypes.STRING(500) },
  issued_at:          { type: DataTypes.DATEONLY },
  paid_at:            { type: DataTypes.DATEONLY },
  notes:              { type: DataTypes.TEXT },
}, { tableName: 'progress_certificates', updatedAt: false });

module.exports = ProgressCertificate;
