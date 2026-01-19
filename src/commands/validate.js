/**
 * Validate cron expression command
 * @module commands/validate
 */
const { validate, parse, describe } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit } = require('../license');
const { success, error, warning, dim, cyan, formatValidation, getUpsell, getLimitUpsell, getPromo } = require('../utils');

/**
 * Execute validate command
 * @param {string} expression - Cron expression
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(expression, options = {}) {
  const { json: jsonOutput = false, strict = false } = options;

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

  // Increment usage
  incrementOperations();

  // Validate
  const result = validate(expression);

  // Additional strict checks
  const warnings = [];
  if (result.valid && strict) {
    const parsed = parse(expression);
    if (parsed.fields) {
      // Check for potentially problematic patterns
      if (parsed.fields.minute.raw === '*' && parsed.fields.hour.raw === '*') {
        warnings.push('Runs every minute (60 times/hour) - intentional?');
      }
      if (parsed.fields.dayOfMonth.raw !== '*' && parsed.fields.dayOfWeek.raw !== '*') {
        warnings.push('Both day-of-month and day-of-week are set - uses OR logic (runs if either matches)');
      }
      // Check for impossible day-of-month (e.g., 31st in February)
      if (parsed.fields.dayOfMonth.values.includes(31) && parsed.fields.month.values.some(m => [2, 4, 6, 9, 11].includes(m))) {
        warnings.push('Day 31 does not exist in all specified months');
      }
      if (parsed.fields.dayOfMonth.values.includes(30) && parsed.fields.month.values.includes(2)) {
        warnings.push('Day 30 does not exist in February');
      }
      if (parsed.fields.dayOfMonth.values.includes(29) && parsed.fields.month.values.includes(2)) {
        warnings.push('Day 29 only exists in February during leap years');
      }
    }
  }

  // JSON output
  if (jsonOutput) {
    const jsonResult = {
      expression,
      valid: result.valid,
      errors: result.errors || [],
      warnings: warnings,
      description: result.valid ? describe(expression) : null
    };
    return {
      code: result.valid ? 0 : 1,
      output: JSON.stringify(jsonResult, null, 2)
    };
  }

  // Human output
  let output = formatValidation(result);

  if (result.valid) {
    output += '\n\n' + dim('Meaning: ') + describe(expression);

    // Show warnings if strict mode
    if (warnings.length > 0) {
      output += '\n\n' + warning('Warnings:');
      warnings.forEach(w => {
        output += '\n  ' + dim('-') + ' ' + w;
      });
    }
  }

  // Maybe upsell
  if (license.tier === 'free') {
    const upsell = getUpsell('generate');
    if (upsell) output += upsell;
  }

  // Maybe promo
  const promo = getPromo();
  if (promo) output += promo;

  return {
    code: result.valid ? 0 : 1,
    output
  };
}

/**
 * Get command help
 * @returns {string}
 */
function help() {
  return `
  cronwtf validate - check if cron expression is valid

  Usage:
    cronwtf validate <expression>
    cronwtf -v <expression>

  Options:
    --strict   show additional warnings for edge cases
    --json     output as JSON

  Examples:
    cronwtf validate "*/15 * * * *"
    cronwtf validate "0 25 * * *"       invalid: hour > 23
    cronwtf validate --strict "* * * * *"
`;
}

module.exports = { execute, help };
