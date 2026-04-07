const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/dailyReportsController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = Router({ mergeParams: true });
router.use(authenticate, authorize('obras'));

// Static routes must come before /:id
router.get('/stats',          ctrl.getStats);
router.get('/match-products', ctrl.matchProducts);
router.get('/',               ctrl.getAll);

router.post('/', [
  body('report_date').isDate().withMessage('Fecha requerida'),
  body('activities').notEmpty().withMessage('Actividades requeridas'),
], validate, ctrl.create);

// Parameterized routes
router.get('/:id',   ctrl.getOne);
router.put('/:id',   ctrl.update);

router.post('/:id/photos', [
  body('url').notEmpty().withMessage('URL de foto requerida'),
], validate, ctrl.addPhoto);
router.delete('/:id/photos/:photoId', ctrl.removePhoto);

router.post('/:id/contractors', ctrl.addContractor);
router.delete('/:id/contractors/:cid', ctrl.removeContractor);

module.exports = router;
