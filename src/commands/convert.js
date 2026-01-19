/**
 * Convert cron formats (PRO)
 * @module commands/convert
 */
const { parse, fromCron, toCron, detectFormat, FORMATS } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit, isPro } = require('../license');
const { success, error, dim, bold, cyan, formatConversion, proRequired, getPromo } = require('../utils');

/**
 * Execute convert command
 * @param {string} expression - Expression to convert
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(expression, options = {}) {
  const {
    to: toFormat,
    from: fromFormat,
    json: jsonOutput = false,
    formats = false
  } = options;

  // Show formats mode
  if (formats) {
    if (jsonOutput) {
      return { code: 0, output: JSON.stringify(FORMATS, null, 2) };
    }

    let output = bold('Supported formats:\n\n');
    Object.entries(FORMATS).forEach(([key, desc]) => {
      output += `  ${cyan(key.padEnd(12))} ${desc}\n`;
    });
    output += '\n' + dim('Use --to <format> to convert TO that format');
    output += '\n' + dim('Use --from <format> to convert FROM that format to standard cron');
    return { code: 0, output };
  }

  // PRO check
  if (!isPro()) {
    return {
      code: 1,
      output: proRequired('convert')
    };
  }

  if (!expression) {
    return {
      code: 1,
      output: error('no expression provided. bruh.')
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

  let result;
  let targetFormat;

  if (fromFormat) {
    // Converting FROM another format TO cron
    result = toCron(expression, fromFormat);
    targetFormat = 'cron';
  } else if (toFormat) {
    // Converting FROM cron TO another format
    // First validate the cron
    const parsed = parse(expression);
    if (!parsed.valid) {
      return {
        code: 1,
        output: error(`invalid cron expression: ${parsed.error || parsed.errors?.join(', ')}`)
      };
    }
    result = fromCron(expression, toFormat);
    targetFormat = toFormat;
  } else {
    // Auto-detect and convert to cron
    const detected = detectFormat(expression);
    if (!detected) {
      return {
        code: 1,
        output: error('could not detect format. use --from <format> to specify.')
      };
    }

    if (detected === 'cron') {
      return {
        code: 1,
        output: error('already standard cron format. use --to <format> to convert elsewhere.')
      };
    }

    result = toCron(expression, detected);
    targetFormat = 'cron';
  }

  if (!result.success) {
    return {
      code: 1,
      output: error(result.error)
    };
  }

  // JSON output
  if (jsonOutput) {
    return {
      code: 0,
      output: JSON.stringify({
        input: expression,
        format: targetFormat,
        result: result.result,
        description: result.description,
        note: result.note
      }, null, 2)
    };
  }

  // Human output
  let output = formatConversion(result, targetFormat);

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
  cronwtf convert - convert between cron formats (PRO)

  Usage:
    cronwtf convert <expression> --to <format>
    cronwtf convert <expression> --from <format>

  Formats:
    cron       Standard 5-field cron
    systemd    systemd OnCalendar format
    aws        AWS CloudWatch Events / EventBridge
    github     GitHub Actions schedule YAML
    quartz     Quartz scheduler (Java)
    jenkins    Jenkins cron syntax

  Options:
    --to <format>     convert TO this format
    --from <format>   convert FROM this format to standard cron
    --formats         show all supported formats
    --json            output as JSON

  Examples:
    cronwtf convert "0 9 * * 1-5" --to aws
    cronwtf convert "0 9 * * 1-5" --to github
    cronwtf convert "cron(0 9 ? * MON-FRI *)" --from aws
    cronwtf convert --formats
`;
}

module.exports = { execute, help };
