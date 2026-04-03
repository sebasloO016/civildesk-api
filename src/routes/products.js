const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/productsController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');
const { auditMiddleware } = require('../middlewares/audit');

const router = Router();
router.use(authenticate, authorize('proveedores'));

router.get('/categories', ctrl.getCategories);
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);

router.post('/import', ctrl.bulkImport);  // importación masiva desde Excel

router.post('/', [
  body('name').notEmpty().withMessage('Nombre requerido'),
  body('unit').notEmpty().withMessage('Unidad requerida'),
], validate, auditMiddleware('products'), ctrl.create);

router.put('/:id',    auditMiddleware('products'), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
