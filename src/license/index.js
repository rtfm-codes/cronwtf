/**
 * License management
 * @module license
 */
const license = require('./license');
const limits = require('./limits');

module.exports = {
  // License
  activateLicense: license.activateLicense,
  deactivateLicense: license.deactivateLicense,
  getLicenseStatus: license.getLicenseStatus,
  isPro: license.isPro,

  // Limits
  incrementOperations: limits.incrementOperations,
  checkOperationLimit: limits.checkOperationLimit,
  getNextRunsLimit: limits.getNextRunsLimit,
  isTimezoneAllowed: limits.isTimezoneAllowed,
  getLimits: limits.getLimits,
  getUsageSummary: limits.getUsageSummary,
  FREE_LIMITS: limits.FREE_LIMITS,
  PRO_LIMITS: limits.PRO_LIMITS
};
