const router = require('express').Router();
const { body } = require('express-validator');
const ctrl   = require('../controllers/worksController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');
const { auditMiddleware } = require('../middlewares/audit');

router.use(authenticate, authorize('obras'));

router.get('/counts', ctrl.getCounts ?? ((req,res) => res.json({data:{data:{}}})));

// Obras CRUD
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);

router.post('/', [
  body('name').notEmpty().withMessage('Nombre de obra requerido'),
  body('start_date').isDate().withMessage('Fecha de inicio inválida'),
], validate, auditMiddleware('works'), ctrl.create);

// Crear obra desde proyecto (importa rubros de proforma aprobada)
router.post('/from-project/:projectId', [
  body('start_date').optional().isDate(),
], validate, ctrl.createFromProject);

router.put('/:id',    auditMiddleware('works'), ctrl.update);
router.delete('/:id', auditMiddleware('works'), ctrl.remove);

// ── Presupuesto y avance ───────────────────────────────────────
router.get('/:id/budget-summary', ctrl.getBudgetSummary);
router.post('/:id/progress',      ctrl.updateProgress);
router.get('/:id/curve-s',        ctrl.getCurveS);

// ── Cierre de obra + sobrantes a bodega ───────────────────────
router.post('/:id/close', ctrl.closeWork);

module.exports = router;
