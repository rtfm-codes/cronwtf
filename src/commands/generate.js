/**
 * Generate cron from natural language (PRO)
 * @module commands/generate
 */
const { generate, getExamples, describe, getNextOccurrences } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit, isPro } = require('../license');
const { success, error, dim, bold, cyan, formatNextRuns, proRequired, getPromo } = require('../utils');

/**
 * Execute generate command
 * @param {string} text - Natural language description
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(text, options = {}) {
  const { json: jsonOutput = false, examples = false } = options;

  // Show examples mode
  if (examples) {
    const exampleList = getExamples();
    if (jsonOutput) {
      return { code: 0, output: JSON.stringify(exampleList, null, 2) };
    }

    let output = bold('Common cron patterns:\n\n');
    exampleList.forEach(ex => {
      output += `  ${cyan(ex.expression.padEnd(18))} ${ex.description}\n`;
    });
    return { code: 0, output };
  }

  // PRO check
  if (!isPro()) {
    return {
      code: 1,
      output: proRequired('generate')
    };
  }

  if (!text) {
    return {
      code: 1,
      output: error('no description provided. try something like "every monday at 9am"')
    };
  }

  // Check limits (even PRO has limits check for consistency)
  const license = getLicenseStatus();
  const limitCheck = checkOperationLimit(license.tier);

  if (!limitCheck.allowed) {
    return {
      code: 1,
      output: error('daily limit reached.')
    };
  }

  // Increment usage
  incrementOperations();

  // Generate
  const result = generate(text);

  if (!result.success) {
    let output = error(result.error);
    if (result.suggestion) {
      output += '\n\n' + dim('Hint: ') + result.suggestion;
    }
    return { code: 1, output };
  }

  // Get description and next runs for verification
  const description = describe(result.expression);
  const nextRuns = getNextOccurrences(result.expression, 3);

  // JSON output
  if (jsonOutput) {
    return {
      code: 0,
      output: JSON.stringify({
        input: text,
        expression: result.expression,
        description,
        nextRuns: nextRuns.map(d => d.toISOString())
      }, null, 2)
    };
  }

  // Human output
  let output = success('generated cron expression:\n\n');
  output += `  ${bold('Input:')}      ${text}\n`;
  output += `  ${bold('Expression:')} ${cyan(result.expression)}\n`;
  output += `  ${bold('Meaning:')}    ${description}\n`;

  if (nextRuns.length > 0) {
    output += '\n' + bold('Next 3 runs:') + '\n';
    output += formatNextRuns(nextRuns);
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
  cronwtf generate - generate cron from plain English (PRO)

  Usage:
    cronwtf generate "<description>"
    cronwtf -g "<description>"

  Options:
    --examples   show common cron patterns
    --json       output as JSON

  Examples:
    cronwtf generate "every 5 minutes"
    cronwtf generate "at 9am on weekdays"
    cronwtf generate "every monday at noon"
    cronwtf generate "first day of month at midnight"
    cronwtf generate --examples
`;
}

module.exports = { execute, help };
