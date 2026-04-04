// ── routes/projects.js ────────────────────────────────────────
const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/projectsController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');
const { auditMiddleware } = require('../middlewares/audit');

const router = Router();
router.use(authenticate, authorize('proyectos'));

// Proyectos CRUD
router.get('/counts', ctrl.getCounts);   // ← DEBE ir antes de /:id
router.get('/',    ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', [
  body('name').notEmpty().withMessage('Nombre requerido'),
  body('client_id').isInt().withMessage('Cliente requerido'),
], validate, auditMiddleware('projects'), ctrl.create);
router.put('/:id', auditMiddleware('projects'), ctrl.update);

// Proformas
router.get('/:id/proformas',     ctrl.getProformas);
router.post('/:id/proformas', [
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
], validate, ctrl.createProforma);
router.patch('/:id/proformas/:proformaId/status', [
  body('status').isIn(['DRAFT','SENT','APPROVED','REJECTED']).withMessage('Estado inválido'),
], validate, ctrl.updateProformaStatus);

// Contratos
router.post('/:id/contract', [
  body('contracted_amount').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
], validate, ctrl.createContract);
router.patch('/:id/contract/sign',     ctrl.signContract);
router.patch('/:id/contract/document', ctrl.updateContractDocument); // ← adjuntar PDF escaneado
router.post('/:id/contract/addendum', [
  body('description').notEmpty().withMessage('Descripción requerida'),
  body('amount').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
], validate, ctrl.addAddendum);

// Liquidación
router.post('/:id/liquidation', [
  body('initial_amount').isFloat({ gt: 0 }).withMessage('Monto inicial requerido'),
], validate, ctrl.createLiquidation);
router.patch('/:id/liquidation/sign', ctrl.signLiquidation);

module.exports = router;
