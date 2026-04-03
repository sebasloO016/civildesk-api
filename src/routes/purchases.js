const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/purchasesController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');

const router = Router();
router.use(authenticate, authorize('proveedores'));

// Solicitudes
router.get('/requests',          ctrl.getAllRequests);
router.post('/requests', [
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
], validate, ctrl.createRequest);
router.post('/requests/:id/generate-orders', ctrl.generateOrdersBySupplier);

// Órdenes de compra
router.get('/orders',     ctrl.getAllOrders);
router.patch('/orders/:id/status', [
  body('status').isIn(['DRAFT','SENT','CONFIRMED','RECEIVED','CANCELLED']).withMessage('Estado inválido'),
], validate, ctrl.updateOrderStatus);

// Gastos de reportes sin factura formal
router.get('/unreconciled',  ctrl.getUnreconciledPurchases);

// Facturas
router.get('/invoices',   ctrl.getAllInvoices);
router.post('/invoices', [
  body('purchase_order_id').isInt().withMessage('Orden de compra requerida'),
  body('invoice_number').notEmpty().withMessage('Número de factura requerido'),
  body('issue_date').isDate().withMessage('Fecha inválida'),
  body('total').isFloat({ gt: 0 }).withMessage('Total debe ser mayor a 0'),
], validate, ctrl.createInvoice);

module.exports = router;
