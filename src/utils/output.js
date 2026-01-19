/**
 * Output formatting utilities
 * @module utils/output
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Check if colors should be disabled
const noColor = process.env.NO_COLOR || process.argv.includes('--no-color');

/**
 * Apply color if terminal supports it
 * @param {string} text - Text to colorize
 * @param {string} color - Color name
 * @returns {string}
 */
function colorize(text, color) {
  if (noColor || !process.stdout.isTTY) return text;
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Success message
 * @param {string} msg - Message
 * @returns {string}
 */
function success(msg) {
  return `${colorize('✓', 'green')} ${msg}`;
}

/**
 * Error message
 * @param {string} msg - Message
 * @returns {string}
 */
function error(msg) {
  return `${colorize('✗', 'red')} ${msg}`;
}

/**
 * Warning message
 * @param {string} msg - Message
 * @returns {string}
 */
function warning(msg) {
  return `${colorize('!', 'yellow')} ${msg}`;
}

/**
 * Info message
 * @param {string} msg - Message
 * @returns {string}
 */
function info(msg) {
  return `${colorize('i', 'blue')} ${msg}`;
}

/**
 * PRO badge
 * @returns {string}
 */
function proBadge() {
  return colorize('[PRO]', 'magenta');
}

/**
 * Dim text
 * @param {string} text - Text
 * @returns {string}
 */
function dim(text) {
  return colorize(text, 'dim');
}

/**
 * Bold text
 * @param {string} text - Text
 * @returns {string}
 */
function bold(text) {
  return colorize(text, 'bold');
}

/**
 * Cyan text
 * @param {string} text - Text
 * @returns {string}
 */
function cyan(text) {
  return colorize(text, 'cyan');
}

/**
 * Format cron field breakdown
 * @param {Object} parsed - Parsed cron
 * @returns {string}
 */
function formatCronBreakdown(parsed) {
  if (!parsed.valid || parsed.isReboot) {
    return parsed.isReboot ? 'Run at system startup (@reboot)' : '';
  }

  const { fields } = parsed;
  const lines = [];

  const fieldLabels = {
    minute: 'Minute',
    hour: 'Hour',
    dayOfMonth: 'Day (Month)',
    month: 'Month',
    dayOfWeek: 'Day (Week)'
  };

  Object.entries(fields).forEach(([name, field]) => {
    const label = fieldLabels[name].padEnd(12);
    const raw = field.raw.padEnd(8);
    const values = field.values.length > 10
      ? `${field.values.slice(0, 10).join(', ')}... (${field.values.length} values)`
      : field.values.join(', ');
    lines.push(`  ${dim(label)} ${cyan(raw)} ${dim('=>')} ${values}`);
  });

  return lines.join('\n');
}

/**
 * Format next occurrences list
 * @param {Array<Date>} dates - Date array
 * @param {Object} options - Options
 * @returns {string}
 */
function formatNextRuns(dates, options = {}) {
  const { timezone = 'local', showRelative = true } = options;
  const { DateTime } = require('luxon');
  const now = DateTime.now();

  const lines = dates.map((date, i) => {
    const dt = DateTime.fromJSDate(date, { zone: timezone });
    const formatted = dt.toFormat('EEE, MMM dd yyyy HH:mm');

    let relative = '';
    if (showRelative) {
      const diff = dt.diff(now, ['days', 'hours', 'minutes']);
      if (diff.days >= 1) {
        relative = `in ${Math.floor(diff.days)}d ${Math.floor(diff.hours % 24)}h`;
      } else if (diff.hours >= 1) {
        relative = `in ${Math.floor(diff.hours)}h ${Math.floor(diff.minutes % 60)}m`;
      } else {
        relative = `in ${Math.floor(diff.minutes)}m`;
      }
      relative = dim(` (${relative})`);
    }

    return `  ${dim(`${i + 1}.`)} ${formatted}${relative}`;
  });

  return lines.join('\n');
}

/**
 * Format comparison diff
 * @param {Object} comparison - Comparison result
 * @returns {string}
 */
function formatComparison(comparison) {
  const lines = [];

  lines.push(bold('Descriptions:'));
  lines.push(`  ${cyan('1:')} ${comparison.descriptions.first}`);
  lines.push(`  ${cyan('2:')} ${comparison.descriptions.second}`);
  lines.push('');

  if (comparison.same) {
    lines.push(success('These expressions are equivalent!'));
  } else {
    lines.push(bold('Differences:'));
    comparison.differences.forEach(diff => {
      lines.push(`  ${warning(diff.field)}: ${cyan(diff.first)} vs ${cyan(diff.second)}`);
    });

    if (comparison.similarities.length > 0) {
      lines.push('');
      lines.push(dim(`Same: ${comparison.similarities.join(', ')}`));
    }
  }

  if (comparison.overlap > 0) {
    lines.push('');
    lines.push(dim(`Overlap: ${comparison.overlap} matching runs in next 10 occurrences`));
  }

  return lines.join('\n');
}

/**
 * Format validation result
 * @param {Object} result - Validation result
 * @returns {string}
 */
function formatValidation(result) {
  if (result.valid) {
    return success('valid cron expression. nice.');
  }
  let output = error('invalid cron expression. bruh.');
  if (result.errors && result.errors.length > 0) {
    result.errors.forEach(err => {
      output += `\n  ${dim('-')} ${err}`;
    });
  }
  if (result.suggestion) {
    output += `\n\n${dim('Hint:')} ${result.suggestion}`;
  }
  return output;
}

/**
 * Format conversion result
 * @param {Object} result - Conversion result
 * @param {string} targetFormat - Target format name
 * @returns {string}
 */
function formatConversion(result, targetFormat) {
  if (!result.success) {
    return error(result.error);
  }

  let output = success(`Converted to ${targetFormat}:\n`);
  output += `\n${cyan(result.result)}\n`;

  if (result.description) {
    output += `\n${dim(result.description)}`;
  }

  if (result.note) {
    output += `\n\n${dim('Note:')} ${result.note}`;
  }

  return output;
}

/**
 * Format calendar output
 * @param {Array<Object>} events - Calendar events
 * @returns {string}
 */
function formatCalendar(events) {
  const { DateTime } = require('luxon');
  const lines = [];

  let currentMonth = '';
  events.forEach(event => {
    const dt = DateTime.fromJSDate(event.date);
    const month = dt.toFormat('MMMM yyyy');

    if (month !== currentMonth) {
      if (currentMonth) lines.push('');
      lines.push(bold(month));
      currentMonth = month;
    }

    const day = dt.toFormat('EEE dd').padEnd(8);
    const time = dt.toFormat('HH:mm');
    lines.push(`  ${dim(day)} ${cyan(time)}`);
  });

  return lines.join('\n');
}

module.exports = {
  success,
  error,
  warning,
  info,
  proBadge,
  dim,
  bold,
  cyan,
  colorize,
  formatCronBreakdown,
  formatNextRuns,
  formatComparison,
  formatValidation,
  formatConversion,
  formatCalendar,
  colors
};
