const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/suppliersController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');
const { auditMiddleware } = require('../middlewares/audit');

const router = Router();
router.use(authenticate, authorize('proveedores'));

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.get('/:id/price-history', ctrl.getPriceHistory);
router.get('/compare/:productId', ctrl.compareProductPrices);

router.post('/', [
  body('name').notEmpty().withMessage('Nombre requerido'),
], validate, auditMiddleware('suppliers'), ctrl.create);

router.put('/:id',    auditMiddleware('suppliers'), ctrl.update);
router.delete('/:id', ctrl.remove);

router.put('/:id/products/:productId/price', [
  body('unit_price').isFloat({ gt: 0 }).withMessage('Precio debe ser mayor a 0'),
], validate, ctrl.updateProductPrice);

module.exports = router;
