/**
 * GET /warehouses/stock/suggestions?product_ids=1,2,3
 * Devuelve stock disponible en bodega general para una lista de productos.
 * Usado en el módulo de Compras para sugerir material antes de crear una O/C.
 */
const { Op }         = require('sequelize');
const { Warehouse, WarehouseItem, Product } = require('../models');
const { success }    = require('../utils/response');

const getSuggestions = async (req, res, next) => {
  try {
    const { product_ids } = req.query;
    if (!product_ids) return success(res, []);

    const ids = String(product_ids).split(',').map(Number).filter(Boolean);
    if (!ids.length) return success(res, []);

    // Bodega general de la empresa
    const generalWh = await Warehouse.findOne({
      where: { company_id: req.company_id, type: 'GENERAL' },
    });
    if (!generalWh) return success(res, []);

    const items = await WarehouseItem.findAll({
      where: {
        warehouse_id: generalWh.id,
        product_id:   { [Op.in]: ids },
        available_quantity: { [Op.gt]: 0 },
      },
      include: [{ model: Product, as: 'product', attributes: ['id','name','unit','reference_price'] }],
    });

    const result = items.map(item => ({
      product_id:         item.product_id,
      product_name:       item.product?.name,
      unit:               item.product?.unit,
      available_quantity: parseFloat(item.available_quantity),
      average_cost:       parseFloat(item.average_cost || 0),
      reference_price:    parseFloat(item.product?.reference_price || 0),
      warehouse_id:       generalWh.id,
      warehouse_name:     generalWh.name,
    }));

    return success(res, result);
  } catch (err) { next(err); }
};

module.exports = { getSuggestions };
