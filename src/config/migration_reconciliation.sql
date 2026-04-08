-- ═══════════════════════════════════════════════════════════════
-- CIVILDESK — Migración: Anti-duplicación de gastos
-- Fix Punto 4 de la auditoría de integridad
-- Ejecutar en psql: \i migration_reconciliation.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar campos de conciliación a report_purchases
ALTER TABLE report_purchases
  ADD COLUMN IF NOT EXISTS purchase_invoice_id  INTEGER REFERENCES purchase_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_billed            BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billed_at            TIMESTAMP,
  ADD COLUMN IF NOT EXISTS financial_tx_id      INTEGER REFERENCES financial_transactions(id) ON DELETE SET NULL;

-- 2. Agregar campos de origen a financial_transactions para trazabilidad
ALTER TABLE financial_transactions
  ADD COLUMN IF NOT EXISTS report_purchase_id   INTEGER REFERENCES report_purchases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reconciled        BOOLEAN DEFAULT FALSE;

-- 3. Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_report_purchases_invoice
  ON report_purchases(purchase_invoice_id)
  WHERE purchase_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_purchases_billed
  ON report_purchases(is_billed, company_id);

CREATE INDEX IF NOT EXISTS idx_financial_tx_report_purchase
  ON financial_transactions(report_purchase_id)
  WHERE report_purchase_id IS NOT NULL;

-- 4. Marcar las transacciones existentes de reporte como no conciliadas
-- (las nuevas se marcarán automáticamente)
UPDATE financial_transactions
SET is_reconciled = FALSE
WHERE category = 'MATERIAL_PURCHASE'
  AND report_purchase_id IS NULL;

-- 5. Vista para ver gastos pendientes de conciliación por obra
CREATE OR REPLACE VIEW v_unreconciled_purchases AS
SELECT
  rp.id             AS report_purchase_id,
  rp.company_id,
  rp.daily_report_id,
  rp.work_id,
  rp.description,
  rp.quantity,
  rp.unit,
  rp.unit_price,
  rp.total,
  rp.created_at     AS purchase_date,
  dr.report_date,
  w.name            AS work_name
FROM report_purchases rp
JOIN daily_reports dr ON dr.id = rp.daily_report_id
JOIN works w          ON w.id  = rp.work_id
WHERE rp.is_billed = FALSE
  AND rp.total > 0
ORDER BY rp.company_id, rp.work_id, dr.report_date DESC;

COMMENT ON VIEW v_unreconciled_purchases IS
  'Gastos de reportes diarios pendientes de conciliar con factura formal';

-- Verificar
SELECT
  COUNT(*) FILTER (WHERE is_billed = FALSE) AS pendientes,
  COUNT(*) FILTER (WHERE is_billed = TRUE)  AS conciliados
FROM report_purchases;

-- ═══════════════════════════════════════════════════════════════
-- CivilDesk — Migración: Estado de pago en rubros de obra
-- Ejecutar en psql: \i migration_work_items_paid_at.sql
-- ═══════════════════════════════════════════════════════════════
 
-- Una sola columna: NULL = por pagar, fecha = pagado ese día
ALTER TABLE work_items
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
 
-- Índice para consultas "rubros pagados de una obra"
CREATE INDEX IF NOT EXISTS idx_work_items_paid_at
  ON work_items(work_id, paid_at)
  WHERE paid_at IS NOT NULL;
 
-- Verificar
SELECT
  COUNT(*) FILTER (WHERE paid_at IS NULL)     AS por_pagar,
  COUNT(*) FILTER (WHERE paid_at IS NOT NULL) AS pagados
FROM work_items;
 