const bcrypt              = require('bcryptjs');
const { Op }              = require('sequelize');
const { User, Role, RefreshToken, Company, Warehouse } = require('../models');
const { generateTokens, verifyRefresh, getRefreshExpiry } = require('../utils/jwt');
const { createError }     = require('../middlewares/errorHandler');
const { ensureGeneralWarehouse } = require('./inventory/inventoryService');

// ── Registrar nueva empresa + admin ──────────────────────────
const register = async ({ company_name, ruc, email, password, first_name, last_name, phone }) => {
  // Verificar email único
  const exists = await User.findOne({ where: { email } });
  if (exists) throw createError('El email ya está registrado', 409);

  // Verificar RUC único solo si viene
  if (ruc) {
    const rucExists = await Company.findOne({ where: { ruc } });
    if (rucExists) throw createError('El RUC ya está registrado', 409);
  }

  // Crear empresa — solo campos que tienen valor
  const companyData = { name: company_name, country: 'Ecuador' };
  if (ruc)   companyData.ruc   = ruc;
  if (email) companyData.email = email;
  const company = await Company.create(companyData);

  // Crear bodega general automáticamente
  await ensureGeneralWarehouse(company.id);

  // Obtener rol Admin
  const adminRole = await Role.findOne({ where: { name: 'ADMIN' } });

  // Crear usuario admin
  const hash = await bcrypt.hash(password, 12);
  const user = await User.create({
    company_id:    company.id,
    role_id:       adminRole.id,
    first_name,
    last_name,
    email,
    password_hash: hash,
    phone,
  });

  const { accessToken, refreshToken } = generateTokens(user.id, company.id, adminRole.id);

  // Guardar refresh token
  await saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken, user: formatUser(user, adminRole), company };
};

// ── Login ─────────────────────────────────────────────────────
const login = async ({ email, password }) => {
  const user = await User.findOne({
    where:   { email },
    include: [{ model: Role, as: 'role' }],
  });

  if (!user || !user.is_active) {
    throw createError('Credenciales inválidas', 401);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw createError('Credenciales inválidas', 401);

  await user.update({ last_login: new Date() });

  const { accessToken, refreshToken } = generateTokens(user.id, user.company_id, user.role_id);
  await saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken, user: formatUser(user, user.role) };
};

// ── Refresh access token ──────────────────────────────────────
const refreshAccessToken = async (token) => {
  if (!token) throw createError('Refresh token requerido', 401);

  const decoded = verifyRefresh(token);

  // Verificar que el token existe en DB y no está expirado
  const stored = await RefreshToken.findOne({
    where: { user_id: decoded.id, token, expires_at: { [Op.gt]: new Date() } },
  });
  if (!stored) throw createError('Refresh token inválido o expirado', 401);

  const user = await User.findByPk(decoded.id, { include: [{ model: Role, as: 'role' }] });
  if (!user || !user.is_active) throw createError('Usuario no encontrado', 401);

  const { accessToken, refreshToken: newRefresh } = generateTokens(user.id, user.company_id, user.role_id);

  // Rotar refresh token
  await stored.destroy();
  await saveRefreshToken(user.id, newRefresh);

  return { accessToken, refreshToken: newRefresh };
};

// ── Logout ────────────────────────────────────────────────────
const logout = async (token) => {
  if (token) {
    await RefreshToken.destroy({ where: { token } });
  }
};

// ── Helpers internos ──────────────────────────────────────────
const saveRefreshToken = async (user_id, token) => {
  await RefreshToken.create({ user_id, token, expires_at: getRefreshExpiry() });
};

const formatUser = (user, role) => ({
  id:         user.id,
  company_id: user.company_id,
  first_name: user.first_name,
  last_name:  user.last_name,
  email:      user.email,
  role:       role?.name,
  avatar_url: user.avatar_url,
});

module.exports = { register, login, refreshAccessToken, logout };
