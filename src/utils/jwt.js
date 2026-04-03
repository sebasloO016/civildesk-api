const jwt = require('jsonwebtoken');

const generateTokens = (userId, companyId, roleId) => {
  const payload = { id: userId, company_id: companyId, role_id: roleId };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

const verifyRefresh = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// Calcular fecha de expiración del refresh token
const getRefreshExpiry = () => {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 7;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
};

module.exports = { generateTokens, verifyRefresh, getRefreshExpiry };
