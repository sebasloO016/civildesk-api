const { Router } = require('express');
const { body }   = require('express-validator');
const ctrl       = require('../controllers/configController');
const { authenticate, authorize, adminOnly } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = Router();
router.use(authenticate);

// Empresa
router.get('/company',    ctrl.getCompany);
router.put('/company', adminOnly, ctrl.updateCompany);

// Stats del sistema
router.get('/stats', ctrl.getSystemStats);

// Roles
router.get('/roles', ctrl.getRoles);

// Usuarios (solo admin)
router.get('/users',      adminOnly, ctrl.getUsers);
router.post('/users', adminOnly, [
  body('first_name').notEmpty().withMessage('Nombre requerido'),
  body('last_name').notEmpty().withMessage('Apellido requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres'),
  body('role_id').isInt().withMessage('Rol requerido'),
], validate, ctrl.createUser);
router.put('/users/:id',        adminOnly, ctrl.updateUser);
router.patch('/users/:id/toggle', adminOnly, ctrl.toggleUser);

// Audit log
router.get('/audit', adminOnly, ctrl.getAuditLog);

module.exports = router;
