const router = require('express').Router();
const { body } = require('express-validator');
const ctrl   = require('../controllers/warehouseController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');
const { getSuggestions } = require('../controllers/warehouseSuggestionsController')


router.use(authenticate, authorize('bodega'));
router.get('/stock/suggestions', getSuggestions)

router.get('/export-excel',      ctrl.exportExcel);
router.get('/',                  ctrl.getAll);
router.get('/stock',             ctrl.getStock);
router.get('/stock/suggestions', ctrl.getStockSuggestions);
router.get('/movements',         ctrl.getMovements);
router.get('/efficiency',        ctrl.getMaterialEfficiency);

router.post('/assign', [
  body('product_id').isInt().withMessage('product_id requerido'),
  body('quantity').isFloat({ gt: 0 }).withMessage('Cantidad debe ser mayor a 0'),
  body('to_work_id').isInt().withMessage('to_work_id requerido'),
], validate, ctrl.assignToWork);

router.post('/reserve', [
  body('warehouse_id').isInt().withMessage('warehouse_id requerido'),
  body('product_id').isInt().withMessage('product_id requerido'),
  body('quantity').isFloat({ gt: 0 }).withMessage('Cantidad debe ser mayor a 0'),
  body('work_id').isInt().withMessage('work_id requerido'),
], validate, ctrl.reserveStock);

module.exports = router;
