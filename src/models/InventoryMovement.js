const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryMovement = sequelize.define('InventoryMovement', {
  id:                   { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id:           { type: DataTypes.INTEGER, allowNull: false },
  product_id:           { type: DataTypes.INTEGER, allowNull: false },
  from_warehouse_id:    { type: DataTypes.INTEGER },
  to_warehouse_id:      { type: DataTypes.INTEGER },
  quantity:             { type: DataTypes.DECIMAL(12,3), allowNull: false },
  unit_cost:            { type: DataTypes.DECIMAL(12,2), defaultValue: 0 },
  total_cost:           { type: DataTypes.DECIMAL(14,2), defaultValue: 0 },
  movement_type:        {
    type: DataTypes.STRING(25), allowNull: false,
    validate: {
      isIn: [['COMPRA','CONSUMO_OBRA','TRASLADO_BODEGA',
              'ASIGNACION_OBRA','AJUSTE','DEVOLUCION',
              'RESERVA','LIBERAR_RESERVA']],
    },
  },
  purchase_invoice_id:  { type: DataTypes.INTEGER },
  daily_report_id:      { type: DataTypes.INTEGER },
  work_id:              { type: DataTypes.INTEGER },
  origin_work_id:       { type: DataTypes.INTEGER },   // v2.0: trazabilidad origen
  reference_note:       { type: DataTypes.STRING(300) },
  movement_date:        { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  created_by:           { type: DataTypes.INTEGER },
}, { tableName: 'inventory_movements', updatedAt: false });

module.exports = InventoryMovement;
