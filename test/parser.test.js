/**
 * Parser tests
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parse, validate, describe: describeCron, getNextOccurrences, compare } = require('../src/core');

describe('parse', () => {
  it('parses basic cron expression', () => {
    const result = parse('0 9 * * *');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.minute.values, [0]);
    assert.deepStrictEqual(result.fields.hour.values, [9]);
  });

  it('parses wildcard fields', () => {
    const result = parse('* * * * *');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.fields.minute.values.length, 60);
    assert.strictEqual(result.fields.hour.values.length, 24);
  });

  it('parses step values', () => {
    const result = parse('*/15 * * * *');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.minute.values, [0, 15, 30, 45]);
  });

  it('parses range values', () => {
    const result = parse('0 9-17 * * *');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.hour.values, [9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('parses list values', () => {
    const result = parse('0 9,12,17 * * *');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.hour.values, [9, 12, 17]);
  });

  it('parses day of week 1-5', () => {
    const result = parse('0 9 * * 1-5');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.dayOfWeek.values, [1, 2, 3, 4, 5]);
  });

  it('parses month names', () => {
    const result = parse('0 0 1 jan,apr,jul,oct *');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.month.values, [1, 4, 7, 10]);
  });

  it('parses day names', () => {
    const result = parse('0 9 * * mon-fri');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.dayOfWeek.values, [1, 2, 3, 4, 5]);
  });

  it('handles Sunday as 0 and 7', () => {
    const result1 = parse('0 0 * * 0');
    const result2 = parse('0 0 * * 7');
    assert.deepStrictEqual(result1.fields.dayOfWeek.values, [0]);
    assert.deepStrictEqual(result2.fields.dayOfWeek.values, [0]);
  });

  it('parses @daily alias', () => {
    const result = parse('@daily');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.minute.values, [0]);
    assert.deepStrictEqual(result.fields.hour.values, [0]);
  });

  it('parses @hourly alias', () => {
    const result = parse('@hourly');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.minute.values, [0]);
    assert.strictEqual(result.fields.hour.values.length, 24);
  });

  it('parses @reboot special', () => {
    const result = parse('@reboot');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.isReboot, true);
  });

  it('rejects invalid field count', () => {
    const result = parse('0 9 *');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('field count'));
  });

  it('rejects unknown alias', () => {
    const result = parse('@invalid');
    assert.strictEqual(result.valid, false);
    assert.ok(result.error.includes('Unknown alias'));
  });

  it('handles 6-field expressions (ignores seconds)', () => {
    const result = parse('0 0 9 * * *');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.fields.minute.values, [0]);
    assert.deepStrictEqual(result.fields.hour.values, [9]);
  });
});

describe('validate', () => {
  it('validates correct expression', () => {
    const result = validate('0 9 * * 1-5');
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.errors, []);
  });

  it('rejects invalid hour', () => {
    const result = validate('0 25 * * *');
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('hour')));
  });

  it('rejects invalid minute', () => {
    const result = validate('60 * * * *');
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid day of month', () => {
    const result = validate('0 0 32 * *');
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid month', () => {
    const result = validate('0 0 * 13 *');
    assert.strictEqual(result.valid, false);
  });
});

describe('describeCron', () => {
  it('describes every minute', () => {
    const desc = describeCron('* * * * *');
    assert.ok(desc.toLowerCase().includes('every minute'));
  });

  it('describes specific time', () => {
    const desc = describeCron('0 9 * * *');
    assert.ok(desc.includes('9'));
  });

  it('describes weekdays', () => {
    const desc = describeCron('0 9 * * 1-5');
    assert.ok(desc.toLowerCase().includes('weekday'));
  });

  it('describes @reboot', () => {
    const desc = describeCron('@reboot');
    assert.ok(desc.toLowerCase().includes('startup'));
  });

  it('describes invalid expression', () => {
    const desc = describeCron('invalid');
    assert.ok(desc.toLowerCase().includes('invalid'));
  });
});

describe('getNextOccurrences', () => {
  it('returns correct number of occurrences', () => {
    const next = getNextOccurrences('0 * * * *', 5);
    assert.strictEqual(next.length, 5);
  });

  it('returns dates in chronological order', () => {
    const next = getNextOccurrences('0 * * * *', 5);
    for (let i = 1; i < next.length; i++) {
      assert.ok(next[i] > next[i - 1]);
    }
  });

  it('returns empty for @reboot', () => {
    const next = getNextOccurrences('@reboot', 5);
    assert.deepStrictEqual(next, []);
  });

  it('returns empty for invalid expression', () => {
    const next = getNextOccurrences('invalid', 5);
    assert.deepStrictEqual(next, []);
  });

  it('respects day-of-week constraint', () => {
    // Every weekday at 9am - should not include weekends
    const next = getNextOccurrences('0 9 * * 1-5', 10);
    next.forEach(date => {
      const day = date.getDay();
      assert.ok(day >= 1 && day <= 5, `Day ${day} should be weekday`);
    });
  });
});

describe('compare', () => {
  it('identifies identical expressions', () => {
    const result = compare('0 9 * * *', '0 9 * * *');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.same, true);
    assert.strictEqual(result.differences.length, 0);
  });

  it('identifies equivalent aliases', () => {
    const result = compare('@daily', '0 0 * * *');
    assert.strictEqual(result.same, true);
  });

  it('identifies differences', () => {
    const result = compare('0 9 * * *', '0 9 * * 1-5');
    assert.strictEqual(result.same, false);
    assert.ok(result.differences.some(d => d.field === 'day of week'));
  });

  it('reports overlap in runs', () => {
    const result = compare('0 9 * * *', '0 9 * * 1-5');
    assert.ok(result.overlap >= 0);
  });

  it('handles invalid expressions', () => {
    const result = compare('invalid', '0 9 * * *');
    assert.strictEqual(result.valid, false);
  });
});
