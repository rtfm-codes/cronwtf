/**
 * Next occurrences command
 * @module commands/next
 */
const { DateTime } = require('luxon');
const { parse, getNextOccurrences } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit, getNextRunsLimit, isTimezoneAllowed } = require('../license');
const { success, error, dim, bold, cyan, formatNextRuns, getUpsell, getLimitUpsell, getPromo } = require('../utils');

/**
 * Execute next command
 * @param {string} expression - Cron expression
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(expression, options = {}) {
  const {
    count = 5,
    timezone = 'local',
    json: jsonOutput = false
  } = options;

  if (!expression) {
    return {
      code: 1,
      output: error('no cron expression provided. bruh.')
    };
  }

  // Check license and limits
  const license = getLicenseStatus();
  const limitCheck = checkOperationLimit(license.tier);

  if (!limitCheck.allowed) {
    return {
      code: 1,
      output: error(`daily limit reached (${limitCheck.limit}/day).`) + getLimitUpsell('operations')
    };
  }

  // Check timezone permission
  if (!isTimezoneAllowed(license.tier, timezone)) {
    return {
      code: 1,
      output: error('custom timezones require PRO.') + getLimitUpsell('timezone')
    };
  }

  // Validate expression first
  const parsed = parse(expression);
  if (!parsed.valid) {
    return {
      code: 1,
      output: error(`invalid expression: ${parsed.error || parsed.errors?.join(', ')}`)
    };
  }

  if (parsed.isReboot) {
    return {
      code: 0,
      output: success('@reboot runs once at system startup - no scheduled times.')
    };
  }

  // Check count limit
  const maxRuns = getNextRunsLimit(license.tier);
  const requestedCount = Math.min(count, maxRuns);

  if (count > maxRuns && license.tier === 'free') {
    // Will show partial results with upsell
  }

  // Increment usage
  incrementOperations();

  // Get actual timezone
  const tz = timezone === 'local' ? DateTime.local().zoneName : timezone;

  // Get next occurrences
  const nextRuns = getNextOccurrences(expression, requestedCount, {
    timezone: tz,
    from: new Date()
  });

  if (nextRuns.length === 0) {
    return {
      code: 0,
      output: success('no upcoming runs found within the next year.')
    };
  }

  // JSON output
  if (jsonOutput) {
    const result = {
      expression,
      timezone: tz,
      count: nextRuns.length,
      nextRuns: nextRuns.map(d => ({
        iso: d.toISOString(),
        local: DateTime.fromJSDate(d, { zone: tz }).toFormat('yyyy-MM-dd HH:mm:ss'),
        unix: Math.floor(d.getTime() / 1000)
      }))
    };
    return { code: 0, output: JSON.stringify(result, null, 2) };
  }

  // Human output
  let output = bold(`Next ${nextRuns.length} runs`) + dim(` (${tz})`) + '\n';
  output += formatNextRuns(nextRuns, { timezone: tz, showRelative: true });

  // Limit warning
  if (count > maxRuns && license.tier === 'free') {
    output += '\n\n' + dim(`(showing ${maxRuns} of ${count} requested - PRO shows up to 100)`);
    output += getLimitUpsell('nextRuns');
  }

  // Maybe promo
  const promo = getPromo();
  if (promo) output += promo;

  return { code: 0, output };
}

/**
 * Get command help
 * @returns {string}
 */
function help() {
  return `
  cronwtf next - show next run times for a cron expression

  Usage:
    cronwtf next <expression> [options]
    cronwtf -n <expression>

  Options:
    -c, --count <n>      number of runs to show (default: 5, max: 5 free, 100 pro)
    -t, --timezone <tz>  timezone (default: local, pro: any timezone)
    --json               output as JSON

  Examples:
    cronwtf next "0 9 * * *"
    cronwtf next "*/30 * * * *" -c 10
    cronwtf next "0 9 * * 1-5" --timezone America/New_York   (PRO)
`;
}

module.exports = { execute, help };
