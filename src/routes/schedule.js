const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/scheduleController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = Router({ mergeParams: true });
router.use(authenticate, authorize('obras'));

router.get('/',    ctrl.getAll);
router.post('/', [
  body('name').notEmpty().withMessage('Nombre requerido'),
  body('planned_start').isDate().withMessage('Fecha inicio requerida'),
  body('planned_end').isDate().withMessage('Fecha fin requerida'),
], validate, ctrl.create);
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
