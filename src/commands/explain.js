/**
 * Explain cron expression command
 * @module commands/explain
 */
const { parse, describe, getNextOccurrences } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit, getNextRunsLimit } = require('../license');
const { success, error, dim, bold, cyan, formatCronBreakdown, formatNextRuns, getUpsell, getLimitUpsell, getPromo } = require('../utils');

/**
 * Execute explain command
 * @param {string} expression - Cron expression
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(expression, options = {}) {
  const { json: jsonOutput = false } = options;

  if (!expression) {
    return {
      code: 1,
      output: error('no cron expression provided. wtf.')
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

  // Increment usage
  incrementOperations();

  // Parse expression
  const parsed = parse(expression);

  if (!parsed.valid) {
    const output = error(`invalid expression: ${parsed.error || parsed.errors?.join(', ')}`);
    return { code: 1, output };
  }

  // Get description
  const description = describe(expression);

  // Get next runs
  const nextRunsLimit = getNextRunsLimit(license.tier);
  const nextRuns = getNextOccurrences(expression, nextRunsLimit);

  // JSON output
  if (jsonOutput) {
    const result = {
      expression,
      valid: true,
      description,
      fields: parsed.fields ? Object.fromEntries(
        Object.entries(parsed.fields).map(([k, v]) => [k, { raw: v.raw, values: v.values }])
      ) : null,
      nextRuns: nextRuns.map(d => d.toISOString())
    };
    return { code: 0, output: JSON.stringify(result, null, 2) };
  }

  // Human output
  let output = '';

  // Expression and description
  output += `${bold('Expression:')} ${cyan(expression)}\n\n`;
  output += `${bold('Meaning:')} ${description}\n`;

  // Field breakdown
  if (!parsed.isReboot) {
    output += '\n' + bold('Fields:') + '\n';
    output += formatCronBreakdown(parsed);
  }

  // Next runs
  if (nextRuns.length > 0) {
    output += '\n\n' + bold(`Next ${nextRuns.length} runs:`) + '\n';
    output += formatNextRuns(nextRuns);

    if (license.tier === 'free') {
      output += '\n' + dim(`(showing ${nextRunsLimit} runs - PRO shows up to 100)`);
    }
  }

  // Maybe upsell
  if (license.tier === 'free') {
    const upsell = getUpsell('nextRuns');
    if (upsell) output += upsell;
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
  cronwtf explain - explain what a cron expression does

  Usage:
    cronwtf explain <expression>
    cronwtf <expression>

  Options:
    --json    output as JSON

  Examples:
    cronwtf "*/15 * * * *"          every 15 minutes
    cronwtf "0 9 * * 1-5"           weekdays at 9am
    cronwtf "0 0 1 * *"             first day of month
    cronwtf explain "@daily"        daily at midnight
`;
}

module.exports = { execute, help };
