/**
 * Test cron against dates (PRO)
 * @module commands/test
 */
const { DateTime } = require('luxon');
const { parse, describe, getNextOccurrences } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit, isPro } = require('../license');
const { success, error, warning, dim, bold, cyan, proRequired, getPromo } = require('../utils');

/**
 * Check if cron matches a specific datetime
 * @param {Object} parsed - Parsed cron
 * @param {DateTime} dt - DateTime to check
 * @returns {boolean}
 */
function cronMatchesTime(parsed, dt) {
  if (!parsed.valid || parsed.isReboot) return false;

  const { fields } = parsed;

  const minute = dt.minute;
  const hour = dt.hour;
  const dayOfMonth = dt.day;
  const month = dt.month;
  const dayOfWeek = dt.weekday % 7; // luxon: 1=Mon, 7=Sun -> 0=Sun

  const minuteMatch = fields.minute.values.includes(minute);
  const hourMatch = fields.hour.values.includes(hour);
  const monthMatch = fields.month.values.includes(month);

  // Day matching (OR logic if both specified)
  const domAll = fields.dayOfMonth.raw === '*';
  const dowAll = fields.dayOfWeek.raw === '*';

  let dayMatch;
  if (domAll && dowAll) {
    dayMatch = true;
  } else if (domAll) {
    dayMatch = fields.dayOfWeek.values.includes(dayOfWeek);
  } else if (dowAll) {
    dayMatch = fields.dayOfMonth.values.includes(dayOfMonth);
  } else {
    dayMatch = fields.dayOfMonth.values.includes(dayOfMonth) ||
               fields.dayOfWeek.values.includes(dayOfWeek);
  }

  return minuteMatch && hourMatch && dayMatch && monthMatch;
}

/**
 * Parse date input (flexible)
 * @param {string} input - Date string
 * @returns {DateTime|null}
 */
function parseDate(input) {
  // Try common formats
  const formats = [
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd',
    'MM/dd/yyyy HH:mm',
    'MM/dd/yyyy',
    'dd/MM/yyyy HH:mm',
    'dd/MM/yyyy',
    'yyyy/MM/dd HH:mm',
    'yyyy/MM/dd'
  ];

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(input, fmt);
    if (dt.isValid) return dt;
  }

  // Try ISO
  const iso = DateTime.fromISO(input);
  if (iso.isValid) return iso;

  // Try natural-ish dates
  const lower = input.toLowerCase();

  if (lower === 'today') return DateTime.now().startOf('day');
  if (lower === 'tomorrow') return DateTime.now().plus({ days: 1 }).startOf('day');
  if (lower === 'yesterday') return DateTime.now().minus({ days: 1 }).startOf('day');
  if (lower === 'now') return DateTime.now();

  // "next monday", "dec 25", etc.
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthMatch = lower.match(new RegExp(`(${months.join('|')})\\w*\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?`, 'i'));
  if (monthMatch) {
    const monthIdx = months.findIndex(m => monthMatch[1].toLowerCase().startsWith(m)) + 1;
    const day = parseInt(monthMatch[2], 10);
    const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : DateTime.now().year;
    return DateTime.local(year, monthIdx, day);
  }

  return null;
}

/**
 * Execute test command
 * @param {string} expression - Cron expression
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(expression, options = {}) {
  const {
    date: dateStr,
    dates: datesStr,
    range: rangeStr,
    json: jsonOutput = false
  } = options;

  // PRO check
  if (!isPro()) {
    return {
      code: 1,
      output: proRequired('test')
    };
  }

  if (!expression) {
    return {
      code: 1,
      output: error('no cron expression provided. bruh.')
    };
  }

  // Validate expression
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
      output: success('@reboot runs at system startup, not at specific times.')
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

  const description = describe(expression);
  const results = [];

  // Test single date
  if (dateStr) {
    const dt = parseDate(dateStr);
    if (!dt) {
      return {
        code: 1,
        output: error(`could not parse date: "${dateStr}"`)
      };
    }

    const matches = cronMatchesTime(parsed, dt);
    results.push({ date: dt, matches });
  }

  // Test multiple dates
  if (datesStr) {
    const dateList = datesStr.split(',').map(s => s.trim());
    for (const d of dateList) {
      const dt = parseDate(d);
      if (dt) {
        results.push({ date: dt, matches: cronMatchesTime(parsed, dt) });
      }
    }
  }

  // Test date range
  if (rangeStr) {
    const [startStr, endStr] = rangeStr.split('..').map(s => s.trim());
    const start = parseDate(startStr);
    const end = parseDate(endStr);

    if (!start || !end) {
      return {
        code: 1,
        output: error(`could not parse range: "${rangeStr}". Use format: 2024-01-01..2024-01-07`)
      };
    }

    // Get all runs in range
    const runsInRange = [];
    let current = start.startOf('minute');
    const endTime = end.endOf('day');
    const maxIterations = 366 * 24 * 60;
    let i = 0;

    while (current <= endTime && i < maxIterations) {
      if (cronMatchesTime(parsed, current)) {
        runsInRange.push(current.toJSDate());
        if (runsInRange.length >= 100) break; // Limit results
      }
      current = current.plus({ minutes: 1 });
      i++;
    }

    // JSON output for range
    if (jsonOutput) {
      return {
        code: 0,
        output: JSON.stringify({
          expression,
          description,
          range: { start: start.toISO(), end: end.toISO() },
          matchCount: runsInRange.length,
          matches: runsInRange.map(d => d.toISOString())
        }, null, 2)
      };
    }

    let output = bold(`Testing: ${expression}\n`);
    output += dim(`Meaning: ${description}\n\n`);
    output += bold(`Range: ${start.toFormat('yyyy-MM-dd')} to ${end.toFormat('yyyy-MM-dd')}\n\n`);

    if (runsInRange.length === 0) {
      output += warning('No runs found in this range.');
    } else {
      output += success(`${runsInRange.length} runs in this range${runsInRange.length >= 100 ? ' (showing first 100)' : ''}:\n\n`);
      runsInRange.slice(0, 20).forEach((d, i) => {
        const dt = DateTime.fromJSDate(d);
        output += `  ${dim(`${i + 1}.`.padStart(4))} ${dt.toFormat('EEE, MMM dd yyyy HH:mm')}\n`;
      });
      if (runsInRange.length > 20) {
        output += dim(`  ... and ${runsInRange.length - 20} more`);
      }
    }

    const promo = getPromo();
    if (promo) output += promo;

    return { code: 0, output };
  }

  // Default: no date specified, show prompt
  if (results.length === 0) {
    return {
      code: 1,
      output: error('specify a date to test with --date, --dates, or --range')
    };
  }

  // JSON output for single/multiple dates
  if (jsonOutput) {
    return {
      code: 0,
      output: JSON.stringify({
        expression,
        description,
        tests: results.map(r => ({
          date: r.date.toISO(),
          matches: r.matches
        }))
      }, null, 2)
    };
  }

  // Human output
  let output = bold(`Testing: ${expression}\n`);
  output += dim(`Meaning: ${description}\n\n`);

  results.forEach(r => {
    const formatted = r.date.toFormat('EEE, MMM dd yyyy HH:mm');
    if (r.matches) {
      output += success(`${formatted} - RUNS\n`);
    } else {
      output += error(`${formatted} - does not run\n`);
    }
  });

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
  cronwtf test - test cron against specific dates (PRO)

  Usage:
    cronwtf test <expression> [options]

  Options:
    --date <date>         test single date (e.g., "2024-12-25 09:00")
    --dates <list>        test multiple dates (comma-separated)
    --range <start..end>  test date range (e.g., "2024-01-01..2024-01-07")
    --json                output as JSON

  Date formats:
    2024-12-25 09:00    ISO-ish
    12/25/2024          US format
    Dec 25, 2024        Natural
    today, tomorrow     Relative

  Examples:
    cronwtf test "0 9 * * 1-5" --date "2024-12-25 09:00"
    cronwtf test "0 0 25 12 *" --dates "2024-12-25,2025-12-25,2026-12-25"
    cronwtf test "0 9 * * *" --range "2024-01-01..2024-01-07"
`;
}

module.exports = { execute, help };
