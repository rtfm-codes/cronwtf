/**
 * Diff/compare cron expressions command
 * @module commands/diff
 */
const { parse, compare } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit } = require('../license');
const { success, error, dim, bold, cyan, formatComparison, getUpsell, getLimitUpsell, getPromo } = require('../utils');

/**
 * Execute diff command
 * @param {string} expr1 - First cron expression
 * @param {string} expr2 - Second cron expression
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(expr1, expr2, options = {}) {
  const { json: jsonOutput = false } = options;

  if (!expr1 || !expr2) {
    return {
      code: 1,
      output: error('need two cron expressions to compare. bruh.')
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

  // Validate both expressions
  const parsed1 = parse(expr1);
  const parsed2 = parse(expr2);

  if (!parsed1.valid) {
    return {
      code: 1,
      output: error(`first expression invalid: ${parsed1.error || parsed1.errors?.join(', ')}`)
    };
  }

  if (!parsed2.valid) {
    return {
      code: 1,
      output: error(`second expression invalid: ${parsed2.error || parsed2.errors?.join(', ')}`)
    };
  }

  // Increment usage
  incrementOperations();

  // Compare
  const comparison = compare(expr1, expr2);

  // JSON output
  if (jsonOutput) {
    const result = {
      expression1: expr1,
      expression2: expr2,
      equivalent: comparison.same,
      differences: comparison.differences,
      similarities: comparison.similarities,
      overlap: comparison.overlap,
      descriptions: comparison.descriptions
    };
    return { code: 0, output: JSON.stringify(result, null, 2) };
  }

  // Human output
  let output = bold('Comparing cron expressions:') + '\n';
  output += `  ${cyan('1:')} ${expr1}\n`;
  output += `  ${cyan('2:')} ${expr2}\n\n`;
  output += formatComparison(comparison);

  // Maybe upsell
  if (license.tier === 'free') {
    const upsell = getUpsell('convert');
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
  cronwtf diff - compare two cron expressions

  Usage:
    cronwtf diff <expr1> <expr2>

  Options:
    --json    output as JSON

  Examples:
    cronwtf diff "0 9 * * *" "0 9 * * 1-5"
    cronwtf diff "*/15 * * * *" "0,15,30,45 * * * *"
    cronwtf diff "@daily" "0 0 * * *"
`;
}

module.exports = { execute, help };
