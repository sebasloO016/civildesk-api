const { Op }        = require('sequelize');
const { Product, Supplier, SupplierProduct } = require('../models');
const { success, created, paginated } = require('../utils/response');
const { createError } = require('../middlewares/errorHandler');

// ── GET /products ─────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;
    const where = { company_id: req.company_id, is_active: true };
    if (category) where.category = category;
    if (search)   where[Op.or]   = [
      { name:        { [Op.iLike]: `%${search}%` } },
      { code:        { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
    ];

    const { rows, count } = await Product.findAndCountAll({
      where,
      order:  [['name', 'ASC']],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    return paginated(res, rows, count, page, limit);
  } catch (err) { next(err); }
};

// ── GET /products/:id ─────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where:   { id: req.params.id, company_id: req.company_id },
      include: [{
        model: Supplier, as: 'suppliers',
        attributes: ['id','name','rating'],
        through: { attributes: ['unit_price','last_updated'] },
      }],
    });
    if (!product) throw createError('Producto no encontrado', 404);
    return success(res, product);
  } catch (err) { next(err); }
};

// ── POST /products ────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const product = await Product.create({ ...req.body, company_id: req.company_id });
    return created(res, product, 'Producto creado');
  } catch (err) { next(err); }
};

// ── PUT /products/:id ─────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!product) throw createError('Producto no encontrado', 404);
    await product.update(req.body);
    return success(res, product, 'Producto actualizado');
  } catch (err) { next(err); }
};

// ── DELETE /products/:id ──────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, company_id: req.company_id } });
    if (!product) throw createError('Producto no encontrado', 404);
    await product.update({ is_active: false });
    return success(res, { id: product.id }, 'Producto desactivado');
  } catch (err) { next(err); }
};

// ── GET /products/categories ──────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    const cats = await Product.findAll({
      where:      { company_id: req.company_id, is_active: true },
      attributes: [[require('sequelize').fn('DISTINCT', require('sequelize').col('category')), 'category']],
      raw:        true,
    });
    return success(res, cats.map(c => c.category).filter(Boolean));
  } catch (err) { next(err); }
};

// ── POST /products/import ─────────────────────────────────────
// Importación masiva desde Excel (ya procesado en frontend con SheetJS)
// Body: { rows: [{ code, name, unit, category, reference_price, supplier_name, supplier_price }] }
const bulkImport = async (req, res, next) => {
  const t = await require('../models').sequelize.transaction();
  try {
    const { rows = [] } = req.body;
    if (!rows.length) throw createError('No hay filas para importar', 400);

    const VALID_UNITS = ['saco','unidad','metro','m²','m³','kg','ton','galón','litro',
                         'rollo','plancha','punto','global','hora','día','ml'];
    const VALID_CATS  = ['estructural','eléctrico','plomería','acabados','muebles','herramienta','otros'];

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };
    const supplierCache = {}; // cache para no buscar el mismo proveedor múltiples veces

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 porque fila 1 es encabezado

      try {
        // Validaciones básicas
        if (!row.name?.trim())
          throw new Error('Nombre requerido');

        const name          = row.name.trim().toUpperCase();
        const code          = row.code?.trim().toUpperCase() || null;
        const unit          = row.unit?.trim().toLowerCase() || 'unidad';
        const category      = row.category?.trim().toLowerCase() || 'otros';
        const referencePrice= parseFloat(row.reference_price) || 0;

        // Buscar producto existente por código o nombre
        let product = null;
        if (code) {
          product = await Product.findOne({
            where: { company_id: req.company_id, code },
            transaction: t,
          });
        }
        if (!product) {
          product = await Product.findOne({
            where: { company_id: req.company_id, name },
            transaction: t,
          });
        }

        if (product) {
          // Actualizar si cambió algo relevante
          const updates = {};
          if (referencePrice > 0 && parseFloat(product.reference_price) !== referencePrice)
            updates.reference_price = referencePrice;
          if (code && product.code !== code) updates.code = code;
          if (Object.keys(updates).length > 0) {
            await product.update(updates, { transaction: t });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          // Crear nuevo producto
          product = await Product.create({
            company_id:      req.company_id,
            code,
            name,
            unit,
            category:        VALID_CATS.includes(category) ? category : 'otros',
            reference_price: referencePrice,
            is_active:       true,
          }, { transaction: t });
          results.created++;
        }

        // Si viene proveedor + precio de proveedor → actualizar supplier_products
        if (row.supplier_name?.trim() && parseFloat(row.supplier_price) > 0) {
          const supplierName = row.supplier_name.trim();
          const supplierPrice = parseFloat(row.supplier_price);

          // Buscar proveedor (con cache)
          if (!supplierCache[supplierName]) {
            const supplier = await Supplier.findOne({
              where: {
                company_id: req.company_id,
                name: { [Op.iLike]: `%${supplierName}%` },
              },
              transaction: t,
            });
            supplierCache[supplierName] = supplier || null;
          }

          const supplier = supplierCache[supplierName];
          if (supplier) {
            await require('../models').sequelize.query(`
              INSERT INTO supplier_products (company_id, supplier_id, product_id, unit_price, last_updated)
              VALUES (:cid, :sid, :pid, :price, NOW())
              ON CONFLICT (supplier_id, product_id)
              DO UPDATE SET unit_price = EXCLUDED.unit_price, last_updated = NOW()
            `, {
              replacements: {
                cid: req.company_id,
                sid: supplier.id,
                pid: product.id,
                price: supplierPrice,
              },
              transaction: t,
            });
          }
        }

      } catch (rowErr) {
        results.errors.push({ row: rowNum, name: rows[i].name || '?', error: rowErr.message });
      }
    }

    await t.commit();
    return success(res, results,
      `Importación completada: ${results.created} creados, ${results.updated} actualizados, ${results.skipped} sin cambios, ${results.errors.length} errores`
    );
  } catch (err) {
    await t.rollback();
    next(err);
  }
};

module.exports = { getAll, getOne, create, update, remove, getCategories, bulkImport };
