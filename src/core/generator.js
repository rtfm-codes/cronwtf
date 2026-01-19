/**
 * Cron expression generator from natural language
 * @module core/generator
 */

// Pattern mappings for natural language
const PATTERNS = {
  // Time patterns
  'every minute': '* * * * *',
  'every hour': '0 * * * *',
  'hourly': '0 * * * *',
  'every day': '0 0 * * *',
  'daily': '0 0 * * *',
  'every week': '0 0 * * 0',
  'weekly': '0 0 * * 0',
  'every month': '0 0 1 * *',
  'monthly': '0 0 1 * *',
  'every year': '0 0 1 1 *',
  'yearly': '0 0 1 1 *',
  'annually': '0 0 1 1 *',
  'at midnight': '0 0 * * *',
  'midnight': '0 0 * * *',
  'at noon': '0 12 * * *',
  'noon': '0 12 * * *',
  'weekdays': '0 9 * * 1-5',
  'weekends': '0 9 * * 0,6',
  'every weekday': '0 9 * * 1-5',
  'every weekend': '0 9 * * 0,6',
  'business hours': '0 9-17 * * 1-5',
  'work hours': '0 9-17 * * 1-5'
};

// Day name mappings
const DAYS = {
  'sunday': 0, 'sun': 0,
  'monday': 1, 'mon': 1,
  'tuesday': 2, 'tue': 2,
  'wednesday': 3, 'wed': 3,
  'thursday': 4, 'thu': 4,
  'friday': 5, 'fri': 5,
  'saturday': 6, 'sat': 6
};

// Month name mappings
const MONTHS = {
  'january': 1, 'jan': 1,
  'february': 2, 'feb': 2,
  'march': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'may': 5,
  'june': 6, 'jun': 6,
  'july': 7, 'jul': 7,
  'august': 8, 'aug': 8,
  'september': 9, 'sep': 9,
  'october': 10, 'oct': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12
};

/**
 * Parse time string (e.g., "3pm", "15:30", "3:45 pm")
 * @param {string} timeStr - Time string
 * @returns {Object|null} { hour, minute } or null
 */
function parseTime(timeStr) {
  const str = timeStr.toLowerCase().trim();

  // Handle "3pm", "3 pm", "3:30pm", "3:30 pm"
  const match12 = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = match12[2] ? parseInt(match12[2], 10) : 0;
    const ampm = match12[3]?.toLowerCase();

    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  // Handle "15:30" (24-hour)
  const match24 = str.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { hour, minute };
    }
  }

  return null;
}

/**
 * Generate cron expression from natural language
 * @param {string} text - Natural language description
 * @returns {Object} Result with expression and description
 */
function generate(text) {
  const input = text.toLowerCase().trim();

  // Check direct pattern matches first
  for (const [pattern, cron] of Object.entries(PATTERNS)) {
    if (input === pattern || input.includes(pattern)) {
      // If there's a time modifier, adjust
      const timeMatch = input.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (timeMatch && cron !== PATTERNS[pattern]) {
        const time = parseTime(timeMatch[1]);
        if (time) {
          const parts = cron.split(' ');
          parts[0] = time.minute.toString();
          parts[1] = time.hour.toString();
          return {
            success: true,
            expression: parts.join(' '),
            description: `Generated from: "${text}"`
          };
        }
      }
      return {
        success: true,
        expression: cron,
        description: `Generated from: "${text}"`
      };
    }
  }

  // Parse complex patterns
  let minute = '*';
  let hour = '*';
  let dayOfMonth = '*';
  let month = '*';
  let dayOfWeek = '*';
  let matched = false;

  // "every N minutes"
  const everyMinutes = input.match(/every\s+(\d+)\s+minutes?/i);
  if (everyMinutes) {
    minute = `*/${everyMinutes[1]}`;
    matched = true;
  }

  // "every N hours"
  const everyHours = input.match(/every\s+(\d+)\s+hours?/i);
  if (everyHours) {
    minute = '0';
    hour = `*/${everyHours[1]}`;
    matched = true;
  }

  // "at HH:MM" or "at H am/pm"
  const atTime = input.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (atTime) {
    const time = parseTime(atTime[1]);
    if (time) {
      minute = time.minute.toString();
      hour = time.hour.toString();
      matched = true;
    }
  }

  // "every day at..."
  const everyDay = input.match(/every\s+day/i);
  if (everyDay) {
    if (minute === '*') minute = '0';
    if (hour === '*') hour = '0';
    matched = true;
  }

  // "on monday/tuesday/etc" or "every monday"
  for (const [dayName, dayNum] of Object.entries(DAYS)) {
    const dayPattern = new RegExp(`(every\\s+|on\\s+)?${dayName}s?`, 'i');
    if (dayPattern.test(input)) {
      dayOfWeek = dayNum.toString();
      if (minute === '*') minute = '0';
      if (hour === '*') hour = '9';
      matched = true;
      break;
    }
  }

  // "on the 1st/15th/etc" of month
  const dayOfMonthMatch = input.match(/on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?/i);
  if (dayOfMonthMatch) {
    const day = parseInt(dayOfMonthMatch[1], 10);
    if (day >= 1 && day <= 31) {
      dayOfMonth = day.toString();
      if (minute === '*') minute = '0';
      if (hour === '*') hour = '0';
      matched = true;
    }
  }

  // "in january/february/etc"
  for (const [monthName, monthNum] of Object.entries(MONTHS)) {
    const monthPattern = new RegExp(`in\\s+${monthName}`, 'i');
    if (monthPattern.test(input)) {
      month = monthNum.toString();
      matched = true;
      break;
    }
  }

  // "monday through friday" or "monday to friday"
  const dayRange = input.match(/(\w+)\s+(?:through|to|-)\s+(\w+)/i);
  if (dayRange) {
    const start = DAYS[dayRange[1].toLowerCase()];
    const end = DAYS[dayRange[2].toLowerCase()];
    if (start !== undefined && end !== undefined) {
      dayOfWeek = `${start}-${end}`;
      if (minute === '*') minute = '0';
      if (hour === '*') hour = '9';
      matched = true;
    }
  }

  if (matched) {
    return {
      success: true,
      expression: `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`,
      description: `Generated from: "${text}"`
    };
  }

  return {
    success: false,
    error: 'Could not parse the description',
    suggestion: 'Try patterns like: "every 5 minutes", "at 3pm on weekdays", "every monday at 9am"'
  };
}

/**
 * Get common cron examples
 * @returns {Array} Array of examples
 */
function getExamples() {
  return [
    { description: 'Every minute', expression: '* * * * *' },
    { description: 'Every 5 minutes', expression: '*/5 * * * *' },
    { description: 'Every hour', expression: '0 * * * *' },
    { description: 'Every day at midnight', expression: '0 0 * * *' },
    { description: 'Every day at 9am', expression: '0 9 * * *' },
    { description: 'Every Monday at 9am', expression: '0 9 * * 1' },
    { description: 'Weekdays at 9am', expression: '0 9 * * 1-5' },
    { description: 'First day of month at midnight', expression: '0 0 1 * *' },
    { description: 'Every 15th at noon', expression: '0 12 15 * *' },
    { description: 'Every Sunday at 6pm', expression: '0 18 * * 0' },
    { description: 'Twice daily (9am and 5pm)', expression: '0 9,17 * * *' },
    { description: 'Every quarter (Jan, Apr, Jul, Oct)', expression: '0 0 1 1,4,7,10 *' }
  ];
}

module.exports = {
  generate,
  parseTime,
  getExamples,
  PATTERNS,
  DAYS,
  MONTHS
};
