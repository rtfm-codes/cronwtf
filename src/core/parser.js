/**
 * Cron expression parser
 * @module core/parser
 */
const { DateTime } = require('luxon');

// Field definitions
const FIELDS = {
  minute: { min: 0, max: 59, names: [] },
  hour: { min: 0, max: 23, names: [] },
  dayOfMonth: { min: 1, max: 31, names: [] },
  month: { min: 1, max: 12, names: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] },
  dayOfWeek: { min: 0, max: 7, names: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] } // 0 and 7 both = Sunday
};

const FIELD_ORDER = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];

// Common cron aliases
const ALIASES = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
  '@reboot': null // special - not a time-based schedule
};

// Human readable field names
const FIELD_NAMES = {
  minute: 'minute',
  hour: 'hour',
  dayOfMonth: 'day of month',
  month: 'month',
  dayOfWeek: 'day of week'
};

/**
 * Parse a single cron field
 * @param {string} field - Field expression
 * @param {Object} def - Field definition
 * @returns {Object} Parsed field with values and description
 */
function parseField(field, def) {
  const { min, max, names } = def;
  let values = new Set();
  let parts = [];
  let outOfRange = [];

  // Handle name replacements (mon, jan, etc.)
  let normalizedField = field.toLowerCase();
  names.forEach((name, i) => {
    const value = def === FIELDS.dayOfWeek ? i : i + 1;
    normalizedField = normalizedField.replace(new RegExp(name, 'gi'), value.toString());
  });

  const segments = normalizedField.split(',');

  for (const segment of segments) {
    // Handle step values (*/5, 1-10/2)
    const [range, step] = segment.split('/');
    const stepNum = step ? parseInt(step, 10) : 1;

    if (range === '*') {
      // All values with optional step
      for (let i = min; i <= max; i += stepNum) {
        values.add(i);
      }
      if (step) {
        parts.push(`every ${stepNum}`);
      } else {
        parts.push('every');
      }
    } else if (range.includes('-')) {
      // Range
      const [startStr, endStr] = range.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      // Check if range bounds are valid
      if (start < min || start > max) outOfRange.push(start);
      if (end < min || end > max) outOfRange.push(end);

      for (let i = start; i <= end; i += stepNum) {
        if (i >= min && i <= max) {
          values.add(i === 7 && def === FIELDS.dayOfWeek ? 0 : i);
        }
      }
      if (step) {
        parts.push(`${start}-${end} every ${stepNum}`);
      } else {
        parts.push(`${start}-${end}`);
      }
    } else {
      // Single value
      let val = parseInt(range, 10);
      const originalVal = val;
      if (val === 7 && def === FIELDS.dayOfWeek) val = 0; // Normalize Sunday

      // Check if value is out of range
      if (originalVal < min || (originalVal > max && !(def === FIELDS.dayOfWeek && originalVal === 7))) {
        outOfRange.push(originalVal);
      } else {
        values.add(val);
      }
      parts.push(originalVal.toString());
    }
  }

  return {
    values: Array.from(values).sort((a, b) => a - b),
    raw: field,
    description: parts.join(', '),
    outOfRange
  };
}

/**
 * Parse a cron expression
 * @param {string} expression - Cron expression (5 or 6 fields)
 * @returns {Object} Parsed cron object
 */
function parse(expression) {
  const trimmed = expression.trim();

  // Check for alias
  if (trimmed.startsWith('@')) {
    const alias = trimmed.toLowerCase();
    if (alias === '@reboot') {
      return {
        valid: true,
        alias: '@reboot',
        fields: null,
        description: 'Run once at system startup',
        isReboot: true
      };
    }
    if (ALIASES[alias]) {
      return parse(ALIASES[alias]);
    }
    return {
      valid: false,
      error: `Unknown alias: ${alias}`,
      suggestion: `Valid aliases: ${Object.keys(ALIASES).join(', ')}`
    };
  }

  const parts = trimmed.split(/\s+/);

  // Support 5 fields (standard) or 6 fields (with seconds - we'll ignore seconds)
  if (parts.length < 5 || parts.length > 6) {
    return {
      valid: false,
      error: `Invalid field count: expected 5, got ${parts.length}`,
      suggestion: 'Format: minute hour day-of-month month day-of-week'
    };
  }

  // If 6 fields, assume first is seconds and skip it
  const fields = parts.length === 6 ? parts.slice(1) : parts;

  const result = {
    valid: true,
    original: expression,
    fields: {}
  };

  const errors = [];

  FIELD_ORDER.forEach((fieldName, i) => {
    try {
      const parsed = parseField(fields[i], FIELDS[fieldName]);
      result.fields[fieldName] = parsed;

      // Check for out of range values
      if (parsed.outOfRange && parsed.outOfRange.length > 0) {
        errors.push(`${FIELD_NAMES[fieldName]}: values out of range (${parsed.outOfRange.join(', ')})`);
      }
    } catch (e) {
      errors.push(`${FIELD_NAMES[fieldName]}: ${e.message}`);
    }
  });

  if (errors.length > 0) {
    result.valid = false;
    result.errors = errors;
  }

  return result;
}

/**
 * Validate a cron expression
 * @param {string} expression - Cron expression
 * @returns {Object} Validation result
 */
function validate(expression) {
  const parsed = parse(expression);
  return {
    valid: parsed.valid,
    errors: parsed.errors || [],
    suggestion: parsed.suggestion
  };
}

/**
 * Get the next N occurrences of a cron schedule
 * @param {string} expression - Cron expression
 * @param {number} count - Number of occurrences
 * @param {Object} options - Options
 * @param {string} options.timezone - Timezone (default: local)
 * @param {Date} options.from - Start date (default: now)
 * @returns {Array<Date>} Next occurrences
 */
function getNextOccurrences(expression, count = 5, options = {}) {
  const parsed = parse(expression);
  if (!parsed.valid || parsed.isReboot) {
    return [];
  }

  const { timezone = 'local', from = new Date() } = options;
  const occurrences = [];

  let current = DateTime.fromJSDate(from, { zone: timezone });

  // Move to next minute to avoid current minute
  current = current.plus({ minutes: 1 }).startOf('minute');

  const maxIterations = 366 * 24 * 60; // Max 1 year of minutes
  let iterations = 0;

  while (occurrences.length < count && iterations < maxIterations) {
    iterations++;

    const minute = current.minute;
    const hour = current.hour;
    const dayOfMonth = current.day;
    const month = current.month;
    const dayOfWeek = current.weekday % 7; // luxon: 1=Mon, 7=Sun -> we want 0=Sun

    // Check if this time matches
    const { fields } = parsed;

    const minuteMatch = fields.minute.values.includes(minute);
    const hourMatch = fields.hour.values.includes(hour);
    const monthMatch = fields.month.values.includes(month);

    // Day matching is special: either day-of-month OR day-of-week can match
    // unless one is * and one is specific
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
      // Both specified: match either (OR logic per POSIX)
      dayMatch = fields.dayOfMonth.values.includes(dayOfMonth) ||
                 fields.dayOfWeek.values.includes(dayOfWeek);
    }

    if (minuteMatch && hourMatch && dayMatch && monthMatch) {
      occurrences.push(current.toJSDate());
    }

    current = current.plus({ minutes: 1 });
  }

  return occurrences;
}

/**
 * Generate human-readable description
 * @param {string} expression - Cron expression
 * @returns {string} Human-readable description
 */
function describe(expression) {
  const parsed = parse(expression);

  if (!parsed.valid) {
    return `Invalid: ${parsed.error || parsed.errors?.join(', ')}`;
  }

  if (parsed.isReboot) {
    return 'Run once at system startup';
  }

  const { fields } = parsed;
  const parts = [];

  // Minutes
  if (fields.minute.raw === '*') {
    parts.push('Every minute');
  } else if (fields.minute.values.length === 1) {
    parts.push(`At minute ${fields.minute.values[0]}`);
  } else if (fields.minute.raw.includes('/')) {
    const step = fields.minute.raw.split('/')[1];
    parts.push(`Every ${step} minutes`);
  } else {
    parts.push(`At minutes ${fields.minute.values.join(', ')}`);
  }

  // Hours
  if (fields.hour.raw !== '*') {
    if (fields.hour.values.length === 1) {
      const h = fields.hour.values[0];
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      parts.push(`at ${h12}${ampm}`);
    } else if (fields.hour.raw.includes('/')) {
      const step = fields.hour.raw.split('/')[1];
      parts.push(`every ${step} hours`);
    } else {
      parts.push(`during hours ${fields.hour.values.join(', ')}`);
    }
  }

  // Day of month
  if (fields.dayOfMonth.raw !== '*') {
    if (fields.dayOfMonth.values.length === 1) {
      parts.push(`on day ${fields.dayOfMonth.values[0]}`);
    } else {
      parts.push(`on days ${fields.dayOfMonth.values.join(', ')}`);
    }
  }

  // Month
  if (fields.month.raw !== '*') {
    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const names = fields.month.values.map(m => monthNames[m]);
    parts.push(`in ${names.join(', ')}`);
  }

  // Day of week
  if (fields.dayOfWeek.raw !== '*') {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const names = fields.dayOfWeek.values.map(d => dayNames[d]);
    if (names.length === 1) {
      parts.push(`on ${names[0]}`);
    } else if (names.length === 5 && !names.includes('Saturday') && !names.includes('Sunday')) {
      parts.push('on weekdays');
    } else if (names.length === 2 && names.includes('Saturday') && names.includes('Sunday')) {
      parts.push('on weekends');
    } else {
      parts.push(`on ${names.join(', ')}`);
    }
  }

  return parts.join(' ');
}

/**
 * Compare two cron expressions
 * @param {string} expr1 - First expression
 * @param {string} expr2 - Second expression
 * @returns {Object} Comparison result
 */
function compare(expr1, expr2) {
  const parsed1 = parse(expr1);
  const parsed2 = parse(expr2);

  if (!parsed1.valid || !parsed2.valid) {
    return {
      valid: false,
      error: !parsed1.valid ? `First expression invalid: ${parsed1.error}` : `Second expression invalid: ${parsed2.error}`
    };
  }

  const differences = [];
  const similarities = [];

  FIELD_ORDER.forEach(fieldName => {
    const vals1 = parsed1.fields[fieldName].values;
    const vals2 = parsed2.fields[fieldName].values;
    const set1 = new Set(vals1);
    const set2 = new Set(vals2);

    const same = vals1.length === vals2.length && vals1.every(v => set2.has(v));

    if (same) {
      similarities.push(FIELD_NAMES[fieldName]);
    } else {
      differences.push({
        field: FIELD_NAMES[fieldName],
        first: parsed1.fields[fieldName].raw,
        second: parsed2.fields[fieldName].raw
      });
    }
  });

  // Compare next 10 occurrences
  const next1 = getNextOccurrences(expr1, 10);
  const next2 = getNextOccurrences(expr2, 10);

  const overlap = next1.filter(d1 =>
    next2.some(d2 => Math.abs(d1.getTime() - d2.getTime()) < 60000)
  );

  return {
    valid: true,
    same: differences.length === 0,
    differences,
    similarities,
    overlap: overlap.length,
    descriptions: {
      first: describe(expr1),
      second: describe(expr2)
    }
  };
}

module.exports = {
  parse,
  validate,
  describe,
  getNextOccurrences,
  compare,
  FIELDS,
  FIELD_ORDER,
  ALIASES
};
