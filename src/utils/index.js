/**
 * Utility functions
 * @module utils
 */
const output = require('./output');
const upsell = require('./upsell');
const promo = require('./promo');

module.exports = {
  // Output
  success: output.success,
  error: output.error,
  warning: output.warning,
  info: output.info,
  proBadge: output.proBadge,
  dim: output.dim,
  bold: output.bold,
  cyan: output.cyan,
  colorize: output.colorize,
  formatCronBreakdown: output.formatCronBreakdown,
  formatNextRuns: output.formatNextRuns,
  formatComparison: output.formatComparison,
  formatValidation: output.formatValidation,
  formatConversion: output.formatConversion,
  formatCalendar: output.formatCalendar,

  // Upsell
  getUpsell: upsell.getUpsell,
  getLimitUpsell: upsell.getLimitUpsell,
  proRequired: upsell.proRequired,

  // Promo
  getPromo: promo.getPromo,
  getAllTools: promo.getAllTools
};
