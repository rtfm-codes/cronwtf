/**
 * Converter tests
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  toAws,
  toSystemd,
  toGitHub,
  toQuartz,
  toCron,
  detectFormat
} = require('../src/core/converter');

describe('toAws', () => {
  it('converts basic cron to AWS format', () => {
    const result = toAws('0 9 * * *');
    assert.strictEqual(result.success, true);
    assert.ok(result.result.includes('cron('));
    assert.ok(result.result.includes('0 9'));
  });

  it('converts weekday cron', () => {
    const result = toAws('0 9 * * 1-5');
    assert.strictEqual(result.success, true);
    // AWS uses 2-6 for Mon-Fri (1=Sun)
    assert.ok(result.result.includes('2-6'));
  });

  it('uses ? for day-of-month when day-of-week is specified', () => {
    const result = toAws('0 9 * * 1');
    assert.strictEqual(result.success, true);
    assert.ok(result.result.includes('?'));
  });

  it('handles invalid expressions', () => {
    const result = toAws('invalid');
    assert.strictEqual(result.success, false);
  });

  it('rejects @reboot', () => {
    const result = toAws('@reboot');
    assert.strictEqual(result.success, false);
  });
});

describe('toSystemd', () => {
  it('converts basic cron to systemd format', () => {
    const result = toSystemd('0 9 * * *');
    assert.strictEqual(result.success, true);
    assert.ok(result.result.includes('9:'));
    assert.ok(result.result.includes(':00'));
  });

  it('converts day of week', () => {
    const result = toSystemd('0 9 * * 1');
    assert.strictEqual(result.success, true);
    assert.ok(result.result.includes('Mon'));
  });

  it('handles @reboot', () => {
    const result = toSystemd('@reboot');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, '@reboot');
  });
});

describe('toGitHub', () => {
  it('converts to GitHub Actions YAML format', () => {
    const result = toGitHub('0 9 * * 1-5');
    assert.strictEqual(result.success, true);
    assert.ok(result.result.includes('on:'));
    assert.ok(result.result.includes('schedule:'));
    assert.ok(result.result.includes('cron:'));
  });

  it('includes the expression', () => {
    const result = toGitHub('0 9 * * *');
    assert.strictEqual(result.success, true);
    assert.ok(result.expression === '0 9 * * *');
  });
});

describe('toQuartz', () => {
  it('converts to Quartz format with seconds', () => {
    const result = toQuartz('0 9 * * *');
    assert.strictEqual(result.success, true);
    // Should start with "0 " for seconds field
    assert.ok(result.result.startsWith('0 '));
  });

  it('uses ? for one of the day fields', () => {
    const result = toQuartz('0 9 * * *');
    assert.strictEqual(result.success, true);
    assert.ok(result.result.includes('?'));
  });
});

describe('toCron (from other formats)', () => {
  it('converts from AWS format', () => {
    const result = toCron('cron(0 9 ? * 2-6 *)', 'aws');
    assert.strictEqual(result.success, true);
    // Should convert to standard cron
    assert.ok(result.result.includes('9'));
  });

  it('converts from systemd preset', () => {
    const result = toCron('daily', 'systemd');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, '0 0 * * *');
  });

  it('converts from Quartz format', () => {
    const result = toCron('0 0 9 * * ?', 'quartz');
    assert.strictEqual(result.success, true);
    // Should strip seconds and convert ? to *
    assert.ok(result.result.includes('9'));
  });

  it('handles unknown format', () => {
    const result = toCron('something', 'unknown');
    assert.strictEqual(result.success, false);
  });
});

describe('detectFormat', () => {
  it('detects AWS format', () => {
    assert.strictEqual(detectFormat('cron(0 9 * * ? *)'), 'aws');
  });

  it('detects standard cron', () => {
    assert.strictEqual(detectFormat('0 9 * * *'), 'cron');
  });

  it('detects Quartz format (6 fields)', () => {
    assert.strictEqual(detectFormat('0 0 9 * * ?'), 'quartz');
  });

  it('returns null for unrecognized format', () => {
    assert.strictEqual(detectFormat('invalid format'), null);
  });
});
