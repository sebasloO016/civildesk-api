const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/catalogController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = Router();
router.use(authenticate, authorize('obras'));

// Stats
router.get('/stats', ctrl.getStats);

// Categorías
router.get('/categories',        ctrl.getCategories);
router.post('/categories', [
  body('name').notEmpty().withMessage('Nombre requerido'),
], validate, ctrl.createCategory);
router.put('/categories/:id',    ctrl.updateCategory);
router.delete('/categories/:id', ctrl.deleteCategory);

// Rubros
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', [
  body('name').notEmpty().withMessage('Nombre requerido'),
  body('unit').notEmpty().withMessage('Unidad requerida'),
], validate, ctrl.create);
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
