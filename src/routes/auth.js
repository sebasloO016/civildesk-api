const router = require('express').Router();
const { body } = require('express-validator');
const ctrl   = require('../controllers/authController');
const { validate }      = require('../middlewares/validate');
const { authenticate }  = require('../middlewares/auth');

// POST /api/auth/register
router.post('/register', [
  body('company_name').notEmpty().withMessage('Nombre de empresa requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('Mínimo 8 caracteres'),
  body('first_name').notEmpty().withMessage('Nombre requerido'),
  body('last_name').notEmpty().withMessage('Apellido requerido'),
], validate, ctrl.register);

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], validate, ctrl.login);

// POST /api/auth/refresh
router.post('/refresh', ctrl.refresh);

// POST /api/auth/logout
router.post('/logout', ctrl.logout);

// GET /api/auth/me
router.get('/me', authenticate, ctrl.me);

module.exports = router;
