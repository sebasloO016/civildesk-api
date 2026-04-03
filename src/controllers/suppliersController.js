const { Op } = require('sequelize');
const { sequelize } = require('../models');
const { QueryTypes }    = require('sequelize');
const {
  Supplier, Product, SupplierProduct, PriceHistory,
} = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError }   = require('../middlewares/errorHandler');
const { variationPct }  = require('../utils/budgetCalculator');

// ── GET /suppliers ────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    const where = { company_id: req.company_id, is_active: true };
    if (category) where.category = category;
    if (search)   where[Op.or]   = [
      { name:  { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } },
      { ruc:   { [Op.iLike]: `%${search}%` } },
    ];

    const { rows, count } = await Supplier.findAndCountAll({
      where,
      order:  [['name', 'ASC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// ── GET /suppliers/:id ────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{
        model: Product, as: 'products',
        through: { attributes: ['unit_price', 'last_updated'] },
      }],
    });
    if (!supplier) throw createError('Proveedor no encontrado', 404);
    return success(res, supplier);
  } catch (err) { next(err); }
};

// ── POST /suppliers ───────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const supplier = await Supplier.create({ ...req.body, company_id: req.company_id });
    return created(res, supplier, 'Proveedor creado');
  } catch (err) { next(err); }
};

// ── PUT /suppliers/:id ────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!supplier) throw createError('Proveedor no encontrado', 404);
    await supplier.update(req.body);
    return success(res, supplier, 'Proveedor actualizado');
  } catch (err) { next(err); }
};

// ── DELETE /suppliers/:id (soft delete) ───────────────────────
const remove = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!supplier) throw createError('Proveedor no encontrado', 404);
    await supplier.update({ is_active: false });
    return success(res, { id: supplier.id }, 'Proveedor desactivado');
  } catch (err) { next(err); }
};

// ── PUT /suppliers/:id/products/:productId/price ─────────────
// Actualizar precio de un producto para este proveedor
const updateProductPrice = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { unit_price } = req.body;
    const { id: supplier_id, productId: product_id } = req.params;

    // Buscar precio actual
    const existing = await SupplierProduct.findOne({
      where: { supplier_id, product_id }, transaction: t,
    });

    const oldPrice = existing?.unit_price || null;

    // Upsert precio
    await SupplierProduct.upsert({
      company_id: req.company_id,
      supplier_id,
      product_id,
      unit_price,
      last_updated: new Date(),
    }, { transaction: t });

    // Registrar historial si cambió el precio
    if (oldPrice && parseFloat(oldPrice) !== parseFloat(unit_price)) {
      const variation = variationPct(parseFloat(oldPrice), parseFloat(unit_price));
      await PriceHistory.create({
        company_id:  req.company_id,
        supplier_id,
        product_id,
        old_price:   oldPrice,
        new_price:   unit_price,
        variation_pct: variation,
        recorded_by: req.user.id,
      }, { transaction: t });

      // Verificar si dispara alerta de precio (se maneja en alertService)
    }

    await t.commit();
    return success(res, { supplier_id, product_id, unit_price }, 'Precio actualizado');
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

// ── GET /suppliers/compare/:productId ────────────────────────
// Comparador de precios del mismo producto entre proveedores
const compareProductPrices = async (req, res, next) => {
  try {
    const rows = await sequelize.query(`
      SELECT
        s.id            AS supplier_id,
        s.name          AS supplier_name,
        s.rating,
        sp.unit_price,
        sp.last_updated,
        p.reference_price,
        CASE
          WHEN p.reference_price > 0
          THEN ROUND(((sp.unit_price - p.reference_price) / p.reference_price) * 100, 2)
          ELSE NULL
        END             AS vs_reference_pct,
        CASE WHEN sp.unit_price = MIN(sp.unit_price) OVER () THEN true ELSE false END AS is_cheapest
      FROM supplier_products sp
      JOIN suppliers s ON s.id = sp.supplier_id
      JOIN products  p ON p.id = sp.product_id
      WHERE sp.product_id = :product_id
        AND s.company_id  = :company_id
        AND s.is_active   = true
      ORDER BY sp.unit_price ASC
    `, {
      replacements: { product_id: req.params.productId, company_id: req.company_id },
      type: QueryTypes.SELECT,
    });

    return success(res, rows);
  } catch (err) { next(err); }
};

// ── GET /suppliers/:id/price-history ─────────────────────────
const getPriceHistory = async (req, res, next) => {
  try {
    const history = await PriceHistory.findAll({
      where:   { supplier_id: req.params.id, company_id: req.company_id },
      include: [{ model: Product, as: 'product', attributes: ['id','name','unit'] }],
      order:   [['recorded_at', 'DESC']],
      limit:   50,
    });
    return success(res, history);
  } catch (err) { next(err); }
};

module.exports = {
  getAll, getOne, create, update, remove,
  updateProductPrice, compareProductPrices, getPriceHistory,
};
