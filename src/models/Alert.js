const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Alert = sequelize.define('Alert', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:   { type: DataTypes.INTEGER, allowNull: false },
  user_id:      { type: DataTypes.INTEGER },
  type:         {
    type: DataTypes.STRING(40), allowNull: false,
    validate: {
      isIn: [['BUDGET_EXCEEDED','SCHEDULE_DELAYED','PRICE_INCREASE',
              'STOCK_LOW','STOCK_IDLE','ADVANCE_DUE','CONTRACT_PENDING']],
    },
  },
  title:        { type: DataTypes.STRING(200), allowNull: false },
  message:      { type: DataTypes.TEXT, allowNull: false },
  entity_type:  { type: DataTypes.STRING(50) },
  entity_id:    { type: DataTypes.INTEGER },
  severity:     {
    type: DataTypes.STRING(10), defaultValue: 'INFO',
    validate: { isIn: [['INFO','WARNING','CRITICAL']] },
  },
  is_read:      { type: DataTypes.BOOLEAN, defaultValue: false },
  read_at:      { type: DataTypes.DATE },
}, { tableName: 'alerts', updatedAt: false });

module.exports = Alert;
