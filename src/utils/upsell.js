/**
 * Upsell messaging
 * @module utils/upsell
 */
const { dim, cyan, bold, proBadge } = require('./output');

// Upsell chance (30%)
const UPSELL_CHANCE = 0.3;

// Upsell messages by feature
const UPSELL_MESSAGES = {
  generate: {
    trigger: 'generate',
    message: 'Generate cron from plain English with PRO',
    example: '"every monday at 9am" → 0 9 * * 1'
  },
  convert: {
    trigger: 'convert',
    message: 'Convert between cron, systemd, AWS, GitHub Actions',
    example: 'cron → AWS CloudWatch format'
  },
  calendar: {
    trigger: 'calendar',
    message: 'Export schedules to iCal/Google Calendar',
    example: 'Import cron runs into your calendar'
  },
  timezone: {
    trigger: 'timezone',
    message: 'Use any timezone with PRO',
    example: 'See runs in America/New_York, Europe/London'
  },
  nextRuns: {
    trigger: 'next',
    message: 'Get up to 100 next runs with PRO',
    example: 'Free: 5 runs | PRO: 100 runs'
  },
  operations: {
    trigger: 'limit',
    message: 'Unlimited daily operations with PRO',
    example: 'Free: 10/day | PRO: unlimited'
  },
  test: {
    trigger: 'test',
    message: 'Test cron against specific dates with PRO',
    example: 'Does it run on Dec 25? Does it skip weekends?'
  },
  interactive: {
    trigger: 'interactive',
    message: 'Build cron expressions interactively',
    example: 'Step-by-step wizard with live preview'
  }
};

/**
 * Get upsell message (30% chance)
 * @param {string} context - Feature context
 * @returns {string|null}
 */
function getUpsell(context) {
  // Random check - 30% chance
  if (Math.random() > UPSELL_CHANCE) {
    return null;
  }

  const upsell = UPSELL_MESSAGES[context];
  if (!upsell) return null;

  return formatUpsell(upsell);
}

/**
 * Format upsell message
 * @param {Object} upsell - Upsell data
 * @returns {string}
 */
function formatUpsell(upsell) {
  let output = '\n\n';
  output += dim('─'.repeat(40)) + '\n';
  output += `${proBadge()} ${upsell.message}\n`;
  if (upsell.example) {
    output += dim(`   ${upsell.example}`) + '\n';
  }
  output += dim(`   $8.99 one-time → `) + cyan('https://rtfm.codes/cronwtf/pro');
  return output;
}

/**
 * Get limit-specific upsell
 * @param {string} type - Limit type ('operations', 'nextRuns', 'timezone')
 * @returns {string}
 */
function getLimitUpsell(type) {
  const messages = {
    operations: {
      message: 'Unlimited daily operations with PRO',
      example: 'Free: 10/day | PRO: unlimited'
    },
    nextRuns: {
      message: 'Get up to 100 next runs with PRO',
      example: 'Free: 5 runs | PRO: 100 runs'
    },
    timezone: {
      message: 'Use any timezone with PRO',
      example: 'See runs in any timezone worldwide'
    }
  };

  const upsell = messages[type];
  if (!upsell) return '';

  return formatUpsell(upsell);
}

/**
 * Get PRO feature required message
 * @param {string} feature - Feature name
 * @returns {string}
 */
function proRequired(feature) {
  const featureNames = {
    generate: 'Generate from text',
    convert: 'Format conversion',
    calendar: 'Calendar export',
    test: 'Date testing',
    interactive: 'Interactive builder'
  };

  const name = featureNames[feature] || feature;
  let output = `${proBadge()} ${bold(name)} requires PRO\n\n`;
  output += `Get PRO for $8.99 (one-time): ${cyan('https://rtfm.codes/cronwtf/pro')}\n`;
  output += dim('Includes: unlimited operations, all timezones, generate, convert, export, and more');
  return output;
}

module.exports = {
  getUpsell,
  formatUpsell,
  getLimitUpsell,
  proRequired,
  UPSELL_MESSAGES,
  UPSELL_CHANCE
};
