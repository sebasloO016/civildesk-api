const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/clientsController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');
const { auditMiddleware } = require('../middlewares/audit');

const router = Router();
router.use(authenticate, authorize('obras'));

router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', [
  body('name').notEmpty().withMessage('Nombre requerido'),
], validate, auditMiddleware('clients'), ctrl.create);
router.put('/:id',    auditMiddleware('clients'), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
