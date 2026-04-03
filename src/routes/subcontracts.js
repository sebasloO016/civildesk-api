const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/subcontractsController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = Router({ mergeParams: true }); // hereda workId del parent
router.use(authenticate, authorize('obras'));

router.get('/',         ctrl.getAll);
router.get('/summary',  ctrl.getSummary);

router.post('/', [
  body('specialty').notEmpty().withMessage('Especialidad requerida'),
  body('supplier_id').isInt().withMessage('Proveedor requerido'),
  body('contracted_amount').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
], validate, ctrl.create);

router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);

router.post('/:id/payments', [
  body('amount').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
  body('payment_date').isDate().withMessage('Fecha inválida'),
], validate, ctrl.addPayment);

module.exports = router;
