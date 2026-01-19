/**
 * Calendar export (PRO)
 * @module commands/calendar
 */
const fs = require('fs');
const { DateTime } = require('luxon');
const { parse, describe, getNextOccurrences } = require('../core');
const { getLicenseStatus, incrementOperations, checkOperationLimit, isPro } = require('../license');
const { success, error, dim, bold, cyan, formatCalendar, proRequired, getPromo } = require('../utils');

/**
 * Generate iCal content
 * @param {Array<Date>} events - Event dates
 * @param {string} expression - Cron expression
 * @param {string} name - Event name
 * @returns {string}
 */
function generateICal(events, expression, name = 'Cron Job') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//cronwtf//rtfm.codes//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${name}`
  ];

  const description = describe(expression);

  events.forEach((date, i) => {
    const dt = DateTime.fromJSDate(date);
    const dtEnd = dt.plus({ minutes: 5 }); // 5 min duration
    const uid = `cronwtf-${dt.toMillis()}-${i}@rtfm.codes`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${DateTime.now().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);
    lines.push(`DTSTART:${dt.toFormat("yyyyMMdd'T'HHmmss")}`);
    lines.push(`DTEND:${dtEnd.toFormat("yyyyMMdd'T'HHmmss")}`);
    lines.push(`SUMMARY:${name}`);
    lines.push(`DESCRIPTION:${expression}\\n${description}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Execute calendar command
 * @param {string} expression - Cron expression
 * @param {Object} options - Command options
 * @returns {Promise<{code: number, output: string}>}
 */
async function execute(expression, options = {}) {
  const {
    output: outputFile,
    count = 30,
    name = 'Cron Job',
    timezone = 'local',
    json: jsonOutput = false,
    preview = false
  } = options;

  // PRO check
  if (!isPro()) {
    return {
      code: 1,
      output: proRequired('calendar')
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
      code: 1,
      output: error('@reboot cannot be exported to calendar.')
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

  // Get timezone
  const tz = timezone === 'local' ? DateTime.local().zoneName : timezone;

  // Get events
  const events = getNextOccurrences(expression, Math.min(count, 100), {
    timezone: tz,
    from: new Date()
  });

  if (events.length === 0) {
    return {
      code: 0,
      output: success('no events found within the next year.')
    };
  }

  // Preview mode
  if (preview) {
    if (jsonOutput) {
      return {
        code: 0,
        output: JSON.stringify({
          expression,
          name,
          timezone: tz,
          events: events.map(d => d.toISOString())
        }, null, 2)
      };
    }

    let output = bold(`Calendar preview: ${name}\n`);
    output += dim(`Expression: ${expression}\n`);
    output += dim(`Timezone: ${tz}\n\n`);
    output += formatCalendar(events.map(d => ({ date: d })));
    return { code: 0, output };
  }

  // Generate iCal
  const ical = generateICal(events, expression, name);

  // Output to file or stdout
  if (outputFile) {
    try {
      fs.writeFileSync(outputFile, ical);
      let output = success(`calendar exported to ${outputFile}\n\n`);
      output += dim(`${events.length} events exported\n`);
      output += dim(`Import into Google Calendar, Apple Calendar, Outlook, etc.`);

      const promo = getPromo();
      if (promo) output += promo;

      return { code: 0, output };
    } catch (e) {
      return {
        code: 1,
        output: error(`failed to write file: ${e.message}`)
      };
    }
  }

  // Return iCal content
  if (jsonOutput) {
    return {
      code: 0,
      output: JSON.stringify({
        expression,
        name,
        timezone: tz,
        eventCount: events.length,
        ical
      }, null, 2)
    };
  }

  return { code: 0, output: ical };
}

/**
 * Get command help
 * @returns {string}
 */
function help() {
  return `
  cronwtf calendar - export cron schedule to iCal (PRO)

  Usage:
    cronwtf calendar <expression> [options]

  Options:
    -o, --output <file>   output file (e.g., schedule.ics)
    -n, --name <name>     event name (default: "Cron Job")
    -c, --count <n>       number of events (default: 30, max: 100)
    -t, --timezone <tz>   timezone (default: local)
    --preview             show calendar preview without exporting
    --json                output as JSON

  Examples:
    cronwtf calendar "0 9 * * 1-5" -o work.ics -n "Daily Standup"
    cronwtf calendar "0 0 1 * *" --preview
    cronwtf calendar "*/30 8-17 * * *" -o alerts.ics -c 50
`;
}

module.exports = { execute, help };
