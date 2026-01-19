/**
 * Generator tests
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { generate, parseTime, getExamples } = require('../src/core/generator');
const { validate } = require('../src/core/parser');

describe('parseTime', () => {
  it('parses 12-hour time with am', () => {
    const result = parseTime('9am');
    assert.deepStrictEqual(result, { hour: 9, minute: 0 });
  });

  it('parses 12-hour time with pm', () => {
    const result = parseTime('3pm');
    assert.deepStrictEqual(result, { hour: 15, minute: 0 });
  });

  it('parses 12-hour time with minutes', () => {
    const result = parseTime('9:30am');
    assert.deepStrictEqual(result, { hour: 9, minute: 30 });
  });

  it('parses 24-hour time', () => {
    const result = parseTime('15:30');
    assert.deepStrictEqual(result, { hour: 15, minute: 30 });
  });

  it('handles noon correctly', () => {
    const result = parseTime('12pm');
    assert.deepStrictEqual(result, { hour: 12, minute: 0 });
  });

  it('handles midnight correctly', () => {
    const result = parseTime('12am');
    assert.deepStrictEqual(result, { hour: 0, minute: 0 });
  });

  it('returns null for invalid time', () => {
    assert.strictEqual(parseTime('25:00'), null);
    assert.strictEqual(parseTime('invalid'), null);
  });
});

describe('generate', () => {
  it('generates every minute', () => {
    const result = generate('every minute');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.expression, '* * * * *');
  });

  it('generates every hour', () => {
    const result = generate('every hour');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.expression, '0 * * * *');
  });

  it('generates daily', () => {
    const result = generate('every day');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.expression, '0 0 * * *');
  });

  it('generates weekly', () => {
    const result = generate('every week');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.expression, '0 0 * * 0');
  });

  it('generates monthly', () => {
    const result = generate('monthly');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.expression, '0 0 1 * *');
  });

  it('generates every N minutes', () => {
    const result = generate('every 5 minutes');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.expression, '*/5 * * * *');
  });

  it('generates every N hours', () => {
    const result = generate('every 2 hours');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.expression, '0 */2 * * *');
  });

  it('generates at specific time', () => {
    const result = generate('at 9am');
    assert.strictEqual(result.success, true);
    assert.ok(result.expression.includes('0 9'));
  });

  it('generates for specific day', () => {
    const result = generate('every monday');
    assert.strictEqual(result.success, true);
    assert.ok(result.expression.includes('1'));
  });

  it('generates weekdays', () => {
    const result = generate('weekdays');
    assert.strictEqual(result.success, true);
    assert.ok(result.expression.includes('1-5'));
  });

  it('generates weekends', () => {
    const result = generate('weekends');
    assert.strictEqual(result.success, true);
    assert.ok(result.expression.includes('0,6'));
  });

  it('validates generated expressions', () => {
    const patterns = [
      'every minute',
      'every 15 minutes',
      'every hour',
      'every day',
      'at noon',
      'at midnight',
      'weekdays',
      'every monday'
    ];

    patterns.forEach(pattern => {
      const result = generate(pattern);
      assert.strictEqual(result.success, true, `Failed for: ${pattern}`);
      const validation = validate(result.expression);
      assert.strictEqual(validation.valid, true, `Generated invalid expression for: ${pattern}`);
    });
  });

  it('returns error for unparseable text', () => {
    const result = generate('something random');
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });
});

describe('getExamples', () => {
  it('returns array of examples', () => {
    const examples = getExamples();
    assert.ok(Array.isArray(examples));
    assert.ok(examples.length > 0);
  });

  it('each example has description and expression', () => {
    const examples = getExamples();
    examples.forEach(ex => {
      assert.ok(ex.description);
      assert.ok(ex.expression);
    });
  });

  it('all example expressions are valid', () => {
    const examples = getExamples();
    examples.forEach(ex => {
      const validation = validate(ex.expression);
      assert.strictEqual(validation.valid, true, `Invalid: ${ex.expression}`);
    });
  });
});
