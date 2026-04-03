const authService = require('../services/authService');
const { success, created, error } = require('../utils/response');

const register = async (req, res, next) => {
  try {
    const data = await authService.register(req.body);
    return created(res, data, 'Empresa y usuario creados exitosamente');
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const data = await authService.login(req.body);
    return success(res, data, 'Login exitoso');
  } catch (err) { next(err); }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const data = await authService.refreshAccessToken(refreshToken);
    return success(res, data, 'Token renovado');
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    return success(res, null, 'Sesión cerrada');
  } catch (err) { next(err); }
};

const me = async (req, res, next) => {
  try {
    return success(res, req.user, 'Usuario autenticado');
  } catch (err) { next(err); }
};

module.exports = { register, login, refresh, logout, me };
