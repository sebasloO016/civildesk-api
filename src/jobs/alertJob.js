const alertService = require('../services/alerts/alertService');
const logger       = require('../config/logger');

// ── Cron job: alertas inteligentes cada hora ──────────────────
// Llamar desde server.js o con node-cron / Bull
const runAlertJob = async () => {
  try {
    logger.info('🔔 Ejecutando job de alertas inteligentes...');
    const count = await alertService.runAlertsForAll();
    logger.info(`✅ Alertas generadas: ${count}`);
  } catch (err) {
    logger.error('❌ Error en job de alertas:', err.message);
  }
};

// Programar con setInterval (simple, sin dependencias extra)
// Para producción reemplazar con node-cron o Bull
const startAlertJob = () => {
  const INTERVAL_MS = 60 * 60 * 1000; // cada hora
  runAlertJob(); // ejecutar inmediatamente al arrancar
  setInterval(runAlertJob, INTERVAL_MS);
  logger.info('⏰ Job de alertas programado (cada 1 hora)');
};

module.exports = { runAlertJob, startAlertJob };
