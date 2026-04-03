const { Router } = require('express');
const { body }   = require('express-validator');
const finCtrl    = require('../controllers/financeController');
const altCtrl    = require('../controllers/alertsController');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');
const { adminOnly } = require('../middlewares/auth');

// ── Finance ───────────────────────────────────────────────────
const finRouter = Router();
finRouter.use(authenticate);   // solo autenticación, permisos ya verificados en auth middleware

finRouter.get('/transactions',   finCtrl.getTransactions);
finRouter.get('/summary',        finCtrl.getSummary);
finRouter.get('/works-summary',  finCtrl.getWorksSummary);
finRouter.get('/cashflow',       finCtrl.getCashflow);

finRouter.post('/transactions', [
  body('work_id').isInt().withMessage('work_id requerido'),
  body('type').isIn(['INCOME','EXPENSE']).withMessage('Tipo inválido'),
  body('category').notEmpty().withMessage('Categoría requerida'),
  body('description').notEmpty().withMessage('Descripción requerida'),
  body('amount').isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),
  body('transaction_date').isDate().withMessage('Fecha inválida'),
], validate, finCtrl.createTransaction);

// ── Alerts ────────────────────────────────────────────────────
const altRouter = Router();
altRouter.use(authenticate);

altRouter.get('/',                altCtrl.getAll);
altRouter.patch('/:id/read',      altCtrl.markRead);
altRouter.patch('/read-all',      altCtrl.markAllRead);
altRouter.post('/run',  adminOnly, altCtrl.runNow);

module.exports = { finRouter, altRouter };
