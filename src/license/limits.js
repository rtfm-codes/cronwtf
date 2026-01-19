/**
 * Usage limits management
 * @module license/limits
 */
const fs = require('fs');
const { USAGE_FILE, CONFIG_DIR, isPro } = require('./license');

// Free tier limits
const FREE_LIMITS = {
  dailyOperations: 10,
  nextRuns: 5,
  timezoneLocal: true // Only local timezone
};

// PRO tier limits
const PRO_LIMITS = {
  dailyOperations: Infinity,
  nextRuns: 100,
  timezoneLocal: false // All timezones
};

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Get today's date string
 * @returns {string} YYYY-MM-DD
 */
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Read usage data
 * @returns {Object} Usage data
 */
function readUsage() {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
    }
  } catch (e) {
    // Invalid file
  }
  return { operations: {} };
}

/**
 * Write usage data
 * @param {Object} data - Usage data
 */
function writeUsage(data) {
  ensureConfigDir();
  fs.writeFileSync(USAGE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Get operations count for today
 * @returns {number}
 */
function getTodayOperations() {
  const usage = readUsage();
  const today = getTodayKey();
  return usage.operations[today] || 0;
}

/**
 * Increment daily operations
 * @returns {number} New count
 */
function incrementOperations() {
  const usage = readUsage();
  const today = getTodayKey();

  // Clean old entries (keep last 7 days)
  const keys = Object.keys(usage.operations || {}).sort().reverse();
  if (keys.length > 7) {
    keys.slice(7).forEach(key => delete usage.operations[key]);
  }

  usage.operations = usage.operations || {};
  usage.operations[today] = (usage.operations[today] || 0) + 1;

  writeUsage(usage);
  return usage.operations[today];
}

/**
 * Check if operation is allowed
 * @param {string} tier - 'free' or 'pro'
 * @returns {Object} { allowed: boolean, remaining: number, limit: number }
 */
function checkOperationLimit(tier) {
  const limits = tier === 'pro' ? PRO_LIMITS : FREE_LIMITS;
  const current = getTodayOperations();

  if (limits.dailyOperations === Infinity) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: Infinity
    };
  }

  return {
    allowed: current < limits.dailyOperations,
    remaining: Math.max(0, limits.dailyOperations - current),
    limit: limits.dailyOperations
  };
}

/**
 * Get next runs limit
 * @param {string} tier - 'free' or 'pro'
 * @returns {number}
 */
function getNextRunsLimit(tier) {
  const limits = tier === 'pro' ? PRO_LIMITS : FREE_LIMITS;
  return limits.nextRuns;
}

/**
 * Check if timezone is allowed
 * @param {string} tier - 'free' or 'pro'
 * @param {string} tz - Timezone name
 * @returns {boolean}
 */
function isTimezoneAllowed(tier, tz) {
  if (tier === 'pro') return true;

  // Free tier: only local timezone
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return !tz || tz === 'local' || tz === localTz;
}

/**
 * Get limits for tier
 * @param {string} tier - 'free' or 'pro'
 * @returns {Object}
 */
function getLimits(tier) {
  return tier === 'pro' ? { ...PRO_LIMITS } : { ...FREE_LIMITS };
}

/**
 * Get usage summary
 * @returns {Object}
 */
function getUsageSummary() {
  const tier = isPro() ? 'pro' : 'free';
  const limits = getLimits(tier);
  const current = getTodayOperations();

  return {
    tier,
    today: current,
    limit: limits.dailyOperations,
    remaining: limits.dailyOperations === Infinity ? Infinity : Math.max(0, limits.dailyOperations - current),
    nextRunsLimit: limits.nextRuns
  };
}

module.exports = {
  incrementOperations,
  checkOperationLimit,
  getNextRunsLimit,
  isTimezoneAllowed,
  getLimits,
  getUsageSummary,
  getTodayOperations,
  FREE_LIMITS,
  PRO_LIMITS
};
