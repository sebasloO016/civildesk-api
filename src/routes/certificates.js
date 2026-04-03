const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/certificatesController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = Router({ mergeParams: true });
router.use(authenticate, authorize('obras'));

router.get('/', ctrl.getAll);

router.post('/', [
  body('period').notEmpty().withMessage('Período requerido'),
  body('progress_pct').isFloat({ min: 0, max: 100 }).withMessage('Avance inválido'),
  body('amount_to_bill').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
], validate, ctrl.create);

router.patch('/:id/approve', ctrl.approve);
router.delete('/:id', ctrl.remove);

module.exports = router;
