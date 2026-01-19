/**
 * License management command
 * @module commands/license
 */
const { getLicenseStatus, activateLicense, deactivateLicense } = require('../license');
const { getUsageSummary } = require('../license');
const { success, error, warning, dim, bold, cyan, proBadge } = require('../utils');

/**
 * Execute license command
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(options = {}) {
  const { key, deactivate = false, json: jsonOutput = false } = options;

  // Deactivate
  if (deactivate) {
    const result = deactivateLicense();
    if (result.success) {
      return {
        code: 0,
        output: success(result.message)
      };
    }
    return {
      code: 1,
      output: error(result.error)
    };
  }

  // Activate with key
  if (key) {
    const result = await activateLicense(key);
    if (result.success) {
      let output = success(`${result.message}\n\n`);
      output += `  ${bold('Email:')} ${result.email}\n`;
      if (result.offline) {
        output += '\n' + warning('Activated in offline mode. Connect to internet for full validation.');
      }
      output += '\n' + dim('Thank you for supporting cronwtf!');
      return { code: 0, output };
    }
    return {
      code: 1,
      output: error(result.error)
    };
  }

  // Show status
  const status = getLicenseStatus();
  const usage = getUsageSummary();

  // JSON output
  if (jsonOutput) {
    return {
      code: 0,
      output: JSON.stringify({
        tier: status.tier,
        active: status.active,
        email: status.email,
        activatedAt: status.activatedAt,
        usage: {
          today: usage.today,
          limit: usage.limit,
          remaining: usage.remaining
        }
      }, null, 2)
    };
  }

  // Human output
  let output = bold('CRONWTF License Status\n\n');

  if (status.tier === 'pro') {
    output += `  ${proBadge()} ${bold('PRO')} license active\n`;
    output += `  ${dim('Email:')} ${status.email}\n`;
    output += `  ${dim('Since:')} ${status.activatedAt}\n`;
    output += '\n' + success('unlimited access to all features.');
  } else {
    output += `  ${bold('FREE')} tier\n\n`;
    output += `  ${dim('Today\'s usage:')} ${usage.today}/${usage.limit} operations\n`;
    output += `  ${dim('Remaining:')} ${usage.remaining}\n`;
    output += `  ${dim('Next runs:')} up to ${usage.nextRunsLimit}\n`;
    output += `  ${dim('Timezones:')} local only\n`;
    output += '\n' + dim('─'.repeat(40)) + '\n';
    output += `  ${proBadge()} Get unlimited access for ${bold('$8.99')} (one-time)\n\n`;
    output += `  Features:\n`;
    output += `  ${cyan('•')} Unlimited daily operations\n`;
    output += `  ${cyan('•')} 100 next runs (vs 5)\n`;
    output += `  ${cyan('•')} All timezones\n`;
    output += `  ${cyan('•')} Generate cron from text\n`;
    output += `  ${cyan('•')} Convert formats (AWS, systemd, GitHub)\n`;
    output += `  ${cyan('•')} Export to calendar\n`;
    output += `  ${cyan('•')} Test against dates\n`;
    output += `  ${cyan('•')} Interactive builder\n\n`;
    output += `  ${cyan('https://rtfm.codes/cronwtf/pro')}`;
  }

  return { code: 0, output };
}

/**
 * Get command help
 * @returns {string}
 */
function help() {
  return `
  cronwtf license - manage PRO license

  Usage:
    cronwtf license                    show license status
    cronwtf license --key <KEY>        activate PRO license
    cronwtf license --deactivate       deactivate license

  Options:
    --key <KEY>      license key to activate
    --deactivate     remove license from this machine
    --json           output as JSON

  Get PRO:
    https://rtfm.codes/cronwtf/pro
`;
}

module.exports = { execute, help };
