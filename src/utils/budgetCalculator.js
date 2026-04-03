// ── Calculadora de presupuesto ────────────────────────────────

/**
 * Calcular totales de presupuesto con utilidad e imprevistos
 * @param {Array}  items         - [{unit_price, quantity}]
 * @param {Number} utilityPct    - % de utilidad (ej: 18)
 * @param {Number} contingencyPct- % de imprevistos (ej: 10)
 */
const calculateBudget = (items, utilityPct = 18, contingencyPct = 10) => {
  const subtotal       = items.reduce((sum, i) => sum + (parseFloat(i.unit_price) * parseFloat(i.quantity)), 0);
  const utilityAmount  = subtotal * (utilityPct / 100);
  const contingencyAmt = subtotal * (contingencyPct / 100);
  const total          = subtotal + utilityAmount + contingencyAmt;

  return {
    subtotal:        round(subtotal),
    utility_pct:     utilityPct,
    contingency_pct: contingencyPct,
    utility_amount:  round(utilityAmount),
    contingency_amt: round(contingencyAmt),
    total:           round(total),
  };
};

/**
 * Calcular precio de venta al cliente desde costo del proveedor
 * precio_venta = costo * (1 + utilidad/100) * (1 + imprevistos/100)
 */
const costToPrice = (cost, utilityPct = 18, contingencyPct = 10) => {
  const withUtility     = cost * (1 + utilityPct / 100);
  const withContingency = withUtility * (1 + contingencyPct / 100);
  return round(withContingency);
};

/**
 * Calcular % de avance ponderado por costo del rubro
 * @param {Array} items - [{initial_total, progress_pct}]
 */
const calculateWeightedProgress = (items) => {
  const totalCost     = items.reduce((sum, i) => sum + parseFloat(i.initial_total || 0), 0);
  if (totalCost === 0) return 0;

  const weightedSum   = items.reduce((sum, i) => {
    return sum + (parseFloat(i.progress_pct || 0) * parseFloat(i.initial_total || 0));
  }, 0);

  return round(weightedSum / totalCost);
};

/**
 * Calcular variación % entre dos valores
 */
const variationPct = (oldVal, newVal) => {
  if (!oldVal || oldVal === 0) return null;
  return round(((newVal - oldVal) / oldVal) * 100);
};

/**
 * Calcular quema de presupuesto
 * Si gasto/presupuesto > avance/100 → hay sobrecosto
 */
const budgetBurnRate = (realCost, initialBudget, actualProgress) => {
  if (!initialBudget || initialBudget === 0) return null;
  const expectedCost  = initialBudget * (actualProgress / 100);
  const burnRate      = realCost / expectedCost;
  return {
    expected_cost: round(expectedCost),
    burn_rate:     round(burnRate, 3),
    is_over:       burnRate > 1.10,  // alerta si supera 10% del esperado
    overrun_pct:   burnRate > 1 ? round((burnRate - 1) * 100) : 0,
  };
};

const round = (val, decimals = 2) => Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);

module.exports = { calculateBudget, costToPrice, calculateWeightedProgress, variationPct, budgetBurnRate, round };
