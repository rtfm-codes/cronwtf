/**
 * Interactive cron builder (PRO)
 * @module commands/interactive
 */
const readline = require('readline');
const { parse, describe, getNextOccurrences, getExamples } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit, isPro } = require('../license');
const { success, error, warning, dim, bold, cyan, formatNextRuns, proRequired } = require('../utils');

/**
 * Prompt user for input
 * @param {readline.Interface} rl - Readline interface
 * @param {string} question - Question to ask
 * @returns {Promise<string>}
 */
function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim());
    });
  });
}

/**
 * Show field options
 * @param {string} field - Field name
 * @returns {string}
 */
function getFieldHelp(field) {
  const help = {
    minute: `
  ${bold('Minute (0-59)')}

  Examples:
    ${cyan('*')}         every minute
    ${cyan('*/5')}       every 5 minutes
    ${cyan('0')}         at minute 0
    ${cyan('0,30')}      at minutes 0 and 30
    ${cyan('15-45')}     minutes 15 through 45`,

    hour: `
  ${bold('Hour (0-23)')}

  Examples:
    ${cyan('*')}         every hour
    ${cyan('*/2')}       every 2 hours
    ${cyan('9')}         at 9 AM
    ${cyan('9,17')}      at 9 AM and 5 PM
    ${cyan('9-17')}      hours 9 through 17`,

    dayOfMonth: `
  ${bold('Day of Month (1-31)')}

  Examples:
    ${cyan('*')}         every day
    ${cyan('1')}         first day
    ${cyan('1,15')}      1st and 15th
    ${cyan('1-7')}       first week`,

    month: `
  ${bold('Month (1-12 or jan-dec)')}

  Examples:
    ${cyan('*')}         every month
    ${cyan('1')}         January
    ${cyan('1,4,7,10')}  quarterly
    ${cyan('jan-mar')}   Q1`,

    dayOfWeek: `
  ${bold('Day of Week (0-7, 0 and 7 are Sunday)')}

  Examples:
    ${cyan('*')}         every day
    ${cyan('1-5')}       weekdays (Mon-Fri)
    ${cyan('0,6')}       weekends
    ${cyan('mon')}       Monday only`
  };

  return help[field] || '';
}

/**
 * Validate field input
 * @param {string} field - Field name
 * @param {string} value - Input value
 * @returns {Object}
 */
function validateField(field, value) {
  const testExpr = {
    minute: `${value} * * * *`,
    hour: `0 ${value} * * *`,
    dayOfMonth: `0 0 ${value} * *`,
    month: `0 0 1 ${value} *`,
    dayOfWeek: `0 0 * * ${value}`
  };

  const expr = testExpr[field];
  const parsed = parse(expr);

  return {
    valid: parsed.valid,
    error: parsed.errors?.join(', ')
  };
}

/**
 * Execute interactive command
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(options = {}) {
  const { quick = false } = options;

  // PRO check
  if (!isPro()) {
    return {
      code: 1,
      output: proRequired('interactive')
    };
  }

  // Check limits
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

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n' + bold('CRONWTF Interactive Builder') + '\n');
  console.log(dim('Build a cron expression step by step.'));
  console.log(dim('Press Ctrl+C to exit at any time.\n'));

  // Quick mode: common presets
  if (quick) {
    console.log(bold('Quick presets:\n'));
    const examples = getExamples();
    examples.forEach((ex, i) => {
      console.log(`  ${dim(`${i + 1}.`)} ${ex.description.padEnd(35)} ${cyan(ex.expression)}`);
    });
    console.log(`  ${dim('0.')} Custom (step-by-step)\n`);

    const choice = await prompt(rl, 'Select preset (0-12): ');
    const idx = parseInt(choice, 10);

    if (idx > 0 && idx <= examples.length) {
      const selected = examples[idx - 1];
      rl.close();

      console.log('\n' + success('Selected:'));
      console.log(`  ${bold('Expression:')} ${cyan(selected.expression)}`);
      console.log(`  ${bold('Meaning:')}    ${selected.description}`);

      const nextRuns = getNextOccurrences(selected.expression, 3);
      if (nextRuns.length > 0) {
        console.log('\n' + bold('Next 3 runs:'));
        console.log(formatNextRuns(nextRuns));
      }

      return { code: 0, output: '' };
    }
    // Fall through to custom builder
    console.log('');
  }

  const fields = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
  const values = {};

  // Build each field
  for (const field of fields) {
    console.log(getFieldHelp(field) + '\n');

    let valid = false;
    while (!valid) {
      const input = await prompt(rl, `  ${field}: `);

      if (!input) {
        values[field] = '*';
        valid = true;
      } else {
        const validation = validateField(field, input);
        if (validation.valid) {
          values[field] = input;
          valid = true;
        } else {
          console.log(error(`Invalid: ${validation.error}. Try again.\n`));
        }
      }
    }

    // Show current expression
    const currentExpr = [
      values.minute || '*',
      values.hour || '*',
      values.dayOfMonth || '*',
      values.month || '*',
      values.dayOfWeek || '*'
    ].join(' ');

    console.log(dim(`  Current: ${currentExpr}\n`));
  }

  rl.close();

  // Final expression
  const expression = `${values.minute} ${values.hour} ${values.dayOfMonth} ${values.month} ${values.dayOfWeek}`;
  const description = describe(expression);
  const nextRuns = getNextOccurrences(expression, 5);

  console.log('\n' + success('Built cron expression:\n'));
  console.log(`  ${bold('Expression:')} ${cyan(expression)}`);
  console.log(`  ${bold('Meaning:')}    ${description}`);

  if (nextRuns.length > 0) {
    console.log('\n' + bold('Next 5 runs:'));
    console.log(formatNextRuns(nextRuns));
  }

  console.log('\n' + dim('Copy the expression above to use it.\n'));

  return { code: 0, output: '' };
}

/**
 * Get command help
 * @returns {string}
 */
function help() {
  return `
  cronwtf interactive - build cron expression step by step (PRO)

  Usage:
    cronwtf interactive
    cronwtf -i

  Options:
    --quick    show preset options first

  This command guides you through building a cron expression
  field by field, with examples and validation at each step.
`;
}

module.exports = { execute, help };
