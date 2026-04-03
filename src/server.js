require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');

const { connectDB }    = require('./config/database');
const logger           = require('./config/logger');
const routes           = require('./routes');
const { errorHandler, notFound } = require('./middlewares/errorHandler');
const { startAlertJob }= require('./jobs/alertJob');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Seguridad ─────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      (process.env.CORS_ORIGINS || '').split(','),
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)        || 100,
  message:  { success: false, message: 'Demasiadas solicitudes, intenta más tarde' },
}));

// ── Parsers ───────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'CivilDesk API corriendo', env: process.env.NODE_ENV });
});

// ── Rutas principales ─────────────────────────────────────────
app.use('/api', routes);

// ── 404 y errores ─────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Arrancar servidor ─────────────────────────────────────────
const start = async () => {
  await connectDB();

  app.listen(PORT, () => {
    logger.info(`🚀 CivilDesk API corriendo en http://localhost:${PORT}`);
    logger.info(`📦 Entorno: ${process.env.NODE_ENV}`);
  });

  // Iniciar job de alertas inteligentes
  if (process.env.NODE_ENV !== 'test') {
    startAlertJob();
  }
};

start();

module.exports = app;
