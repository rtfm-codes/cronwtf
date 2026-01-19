/**
 * Cron format converter
 * @module core/converter
 */
const { parse, describe } = require('./parser');

/**
 * Supported formats
 */
const FORMATS = {
  cron: 'Standard cron (5 fields)',
  systemd: 'systemd OnCalendar format',
  aws: 'AWS CloudWatch Events / EventBridge',
  github: 'GitHub Actions schedule',
  quartz: 'Quartz scheduler (Java)',
  jenkins: 'Jenkins cron syntax'
};

/**
 * Convert standard cron to systemd OnCalendar format
 * @param {string} expression - Cron expression
 * @returns {Object} Conversion result
 */
function toSystemd(expression) {
  const parsed = parse(expression);
  if (!parsed.valid) {
    return { success: false, error: parsed.error || parsed.errors?.join(', ') };
  }

  if (parsed.isReboot) {
    return { success: true, format: 'systemd', result: '@reboot' };
  }

  const { fields } = parsed;

  // Build OnCalendar string
  // Format: DayOfWeek Year-Month-Day Hour:Minute:Second
  const parts = [];

  // Day of week
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (fields.dayOfWeek.raw !== '*') {
    const days = fields.dayOfWeek.values.map(d => dayNames[d]);
    parts.push(days.join(','));
  }

  // Date (year-month-day)
  let datePart = '*';
  if (fields.month.raw !== '*' || fields.dayOfMonth.raw !== '*') {
    const monthPart = fields.month.raw === '*' ? '*' : fields.month.values.join(',');
    const dayPart = fields.dayOfMonth.raw === '*' ? '*' : fields.dayOfMonth.values.join(',');
    datePart = `*-${monthPart}-${dayPart}`;
  }
  parts.push(datePart);

  // Time (hour:minute:second)
  const hourPart = fields.hour.raw === '*' ? '*' :
    fields.hour.raw.includes('/') ? fields.hour.raw :
      fields.hour.values.join(',');
  const minutePart = fields.minute.raw === '*' ? '*' :
    fields.minute.raw.includes('/') ? fields.minute.raw :
      fields.minute.values.join(',');

  parts.push(`${hourPart}:${minutePart}:00`);

  return {
    success: true,
    format: 'systemd',
    result: parts.join(' '),
    note: 'Use with OnCalendar= in systemd timer units'
  };
}

/**
 * Convert standard cron to AWS CloudWatch Events format
 * @param {string} expression - Cron expression
 * @returns {Object} Conversion result
 */
function toAws(expression) {
  const parsed = parse(expression);
  if (!parsed.valid) {
    return { success: false, error: parsed.error || parsed.errors?.join(', ') };
  }

  if (parsed.isReboot) {
    return { success: false, error: 'AWS does not support @reboot' };
  }

  const { fields } = parsed;

  // AWS format: cron(minutes hours day-of-month month day-of-week year)
  // AWS uses ? for "no specific value" for day-of-month or day-of-week
  let domField = fields.dayOfMonth.raw;
  let dowField = fields.dayOfWeek.raw;

  // In AWS, you can't use * for both day fields, must use ? for one
  if (domField === '*' && dowField === '*') {
    dowField = '?';
  } else if (domField !== '*' && dowField === '*') {
    dowField = '?';
  } else if (domField === '*' && dowField !== '*') {
    domField = '?';
  }

  // AWS day of week: 1=Sun, 7=Sat (different from standard 0=Sun)
  if (dowField !== '*' && dowField !== '?') {
    // Check if original is a range pattern
    const rangeMatch = fields.dayOfWeek.raw.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      // Convert to AWS: 0->1 (Sun), 1->2 (Mon), etc.
      const awsStart = start === 0 ? 1 : start + 1;
      const awsEnd = end === 0 ? 1 : end + 1;
      dowField = `${awsStart}-${awsEnd}`;
    } else {
      const awsDow = fields.dayOfWeek.values.map(d => d === 0 ? 1 : d + 1);
      dowField = awsDow.join(',');
    }
  }

  const awsCron = `cron(${fields.minute.raw} ${fields.hour.raw} ${domField} ${fields.month.raw} ${dowField} *)`;

  return {
    success: true,
    format: 'aws',
    result: awsCron,
    note: 'AWS CloudWatch Events / EventBridge format (times in UTC)'
  };
}

/**
 * Convert standard cron to GitHub Actions format
 * @param {string} expression - Cron expression
 * @returns {Object} Conversion result
 */
function toGitHub(expression) {
  const parsed = parse(expression);
  if (!parsed.valid) {
    return { success: false, error: parsed.error || parsed.errors?.join(', ') };
  }

  if (parsed.isReboot) {
    return { success: false, error: 'GitHub Actions does not support @reboot' };
  }

  // GitHub uses standard 5-field cron, but in YAML
  const { fields } = parsed;
  const cronExpr = `${fields.minute.raw} ${fields.hour.raw} ${fields.dayOfMonth.raw} ${fields.month.raw} ${fields.dayOfWeek.raw}`;

  const yaml = `on:
  schedule:
    - cron: '${cronExpr}'`;

  return {
    success: true,
    format: 'github',
    result: yaml,
    expression: cronExpr,
    note: 'GitHub Actions uses UTC timezone'
  };
}

/**
 * Convert standard cron to Quartz format (6 or 7 fields)
 * @param {string} expression - Cron expression
 * @returns {Object} Conversion result
 */
function toQuartz(expression) {
  const parsed = parse(expression);
  if (!parsed.valid) {
    return { success: false, error: parsed.error || parsed.errors?.join(', ') };
  }

  if (parsed.isReboot) {
    return { success: false, error: 'Quartz does not support @reboot' };
  }

  const { fields } = parsed;

  // Quartz format: seconds minutes hours day-of-month month day-of-week [year]
  // Quartz uses ? for "no specific value" for day-of-month or day-of-week
  let domField = fields.dayOfMonth.raw;
  let dowField = fields.dayOfWeek.raw;

  if (domField === '*' && dowField === '*') {
    dowField = '?';
  } else if (domField !== '*' && dowField === '*') {
    dowField = '?';
  } else if (domField === '*' && dowField !== '*') {
    domField = '?';
  }

  // Quartz day of week: 1=Sun, 7=Sat
  if (dowField !== '*' && dowField !== '?') {
    const quartzDow = fields.dayOfWeek.values.map(d => d === 0 ? 1 : d + 1);
    dowField = quartzDow.join(',');
  }

  const quartzCron = `0 ${fields.minute.raw} ${fields.hour.raw} ${domField} ${fields.month.raw} ${dowField}`;

  return {
    success: true,
    format: 'quartz',
    result: quartzCron,
    note: 'Quartz Scheduler format (Java). First field is seconds.'
  };
}

/**
 * Convert AWS format to standard cron
 * @param {string} awsExpr - AWS cron expression
 * @returns {Object} Conversion result
 */
function fromAws(awsExpr) {
  // AWS format: cron(minutes hours day-of-month month day-of-week year)
  const match = awsExpr.match(/cron\s*\(\s*(.+)\s*\)/i);
  if (!match) {
    return { success: false, error: 'Invalid AWS cron format. Expected: cron(...)' };
  }

  const parts = match[1].trim().split(/\s+/);
  if (parts.length !== 6) {
    return { success: false, error: `Invalid AWS cron: expected 6 fields, got ${parts.length}` };
  }

  let [minute, hour, dom, month, dow] = parts;
  // Ignore year field (parts[5])

  // Convert ? to *
  if (dom === '?') dom = '*';
  if (dow === '?') dow = '*';

  // Convert AWS day of week (1=Sun) to standard (0=Sun)
  if (dow !== '*') {
    dow = dow.split(',').map(d => {
      const num = parseInt(d, 10);
      if (!isNaN(num)) {
        return num === 1 ? 0 : num - 1;
      }
      return d;
    }).join(',');
  }

  const standardCron = `${minute} ${hour} ${dom} ${month} ${dow}`;

  return {
    success: true,
    format: 'cron',
    result: standardCron,
    description: describe(standardCron)
  };
}

/**
 * Convert systemd OnCalendar to standard cron (best effort)
 * @param {string} systemdExpr - systemd OnCalendar expression
 * @returns {Object} Conversion result
 */
function fromSystemd(systemdExpr) {
  // This is a simplified parser - systemd has many more features
  const expr = systemdExpr.trim();

  // Handle special cases
  if (expr === 'minutely') return { success: true, format: 'cron', result: '* * * * *' };
  if (expr === 'hourly') return { success: true, format: 'cron', result: '0 * * * *' };
  if (expr === 'daily') return { success: true, format: 'cron', result: '0 0 * * *' };
  if (expr === 'weekly') return { success: true, format: 'cron', result: '0 0 * * 0' };
  if (expr === 'monthly') return { success: true, format: 'cron', result: '0 0 1 * *' };
  if (expr === 'yearly' || expr === 'annually') return { success: true, format: 'cron', result: '0 0 1 1 *' };

  // Try to parse format: [DayOfWeek] [Year-Month-Day] Hour:Minute[:Second]
  const parts = expr.split(/\s+/);
  let dow = '*';
  let dom = '*';
  let month = '*';
  let hour = '*';
  let minute = '*';

  for (const part of parts) {
    // Day of week
    const dayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    if (Object.keys(dayMap).some(d => part.includes(d))) {
      const days = part.split(',').map(d => dayMap[d]).filter(d => d !== undefined);
      if (days.length > 0) dow = days.join(',');
      continue;
    }

    // Date (Year-Month-Day)
    if (part.includes('-') && !part.includes(':')) {
      const dateParts = part.split('-');
      if (dateParts.length >= 2) {
        // Could be *-month-day or year-month-day
        const monthPart = dateParts[dateParts.length - 2];
        const dayPart = dateParts[dateParts.length - 1];
        if (monthPart !== '*') month = monthPart;
        if (dayPart !== '*') dom = dayPart;
      }
      continue;
    }

    // Time (Hour:Minute:Second)
    if (part.includes(':')) {
      const timeParts = part.split(':');
      if (timeParts[0] !== '*') hour = timeParts[0];
      if (timeParts.length > 1 && timeParts[1] !== '*') minute = timeParts[1];
      continue;
    }
  }

  const standardCron = `${minute} ${hour} ${dom} ${month} ${dow}`;

  return {
    success: true,
    format: 'cron',
    result: standardCron,
    description: describe(standardCron),
    note: 'Conversion is best-effort. Some systemd features may not translate.'
  };
}

/**
 * Convert from any supported format to standard cron
 * @param {string} expression - Expression to convert
 * @param {string} fromFormat - Source format
 * @returns {Object} Conversion result
 */
function toCron(expression, fromFormat) {
  switch (fromFormat.toLowerCase()) {
    case 'aws':
      return fromAws(expression);
    case 'systemd':
      return fromSystemd(expression);
    case 'quartz':
    case 'jenkins':
      // These have seconds field, strip it
      const parts = expression.trim().split(/\s+/);
      if (parts.length === 6 || parts.length === 7) {
        const cronParts = parts.slice(1, 6); // Skip seconds, take next 5
        // Handle ? -> *
        const result = cronParts.map(p => p === '?' ? '*' : p).join(' ');
        return { success: true, format: 'cron', result, description: describe(result) };
      }
      return { success: false, error: 'Invalid Quartz/Jenkins format' };
    default:
      return { success: false, error: `Unknown format: ${fromFormat}` };
  }
}

/**
 * Convert standard cron to specified format
 * @param {string} expression - Cron expression
 * @param {string} toFormat - Target format
 * @returns {Object} Conversion result
 */
function fromCron(expression, toFormat) {
  switch (toFormat.toLowerCase()) {
    case 'systemd':
      return toSystemd(expression);
    case 'aws':
      return toAws(expression);
    case 'github':
      return toGitHub(expression);
    case 'quartz':
    case 'jenkins':
      return toQuartz(expression);
    default:
      return { success: false, error: `Unknown format: ${toFormat}` };
  }
}

/**
 * Auto-detect format of expression
 * @param {string} expression - Expression to detect
 * @returns {string|null} Detected format or null
 */
function detectFormat(expression) {
  const expr = expression.trim();

  if (expr.match(/^cron\s*\(/i)) return 'aws';
  if (expr.includes('OnCalendar') || expr.match(/^\w+-\w+-\w+\s/)) return 'systemd';

  const parts = expr.split(/\s+/);
  if (parts.length === 5) return 'cron';
  if (parts.length === 6) return 'quartz'; // or jenkins, they're similar
  if (parts.length === 7) return 'quartz';

  return null;
}

module.exports = {
  toSystemd,
  toAws,
  toGitHub,
  toQuartz,
  toCron,
  fromCron,
  detectFormat,
  FORMATS
};
