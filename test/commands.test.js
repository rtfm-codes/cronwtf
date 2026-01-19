/**
 * Commands tests
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock license for tests
const configDir = path.join(os.homedir(), '.cronwtf');
const licenseFile = path.join(configDir, 'license.json');
const usageFile = path.join(configDir, 'usage.json');

// Save original files
let originalLicense = null;
let originalUsage = null;

function backupFiles() {
  try {
    if (fs.existsSync(licenseFile)) {
      originalLicense = fs.readFileSync(licenseFile, 'utf8');
    }
    if (fs.existsSync(usageFile)) {
      originalUsage = fs.readFileSync(usageFile, 'utf8');
    }
  } catch (e) {}
}

function restoreFiles() {
  try {
    if (originalLicense) {
      fs.writeFileSync(licenseFile, originalLicense);
    } else if (fs.existsSync(licenseFile)) {
      fs.unlinkSync(licenseFile);
    }
    if (originalUsage) {
      fs.writeFileSync(usageFile, originalUsage);
    } else if (fs.existsSync(usageFile)) {
      fs.unlinkSync(usageFile);
    }
  } catch (e) {}
}

function setFreeTier() {
  if (fs.existsSync(licenseFile)) {
    fs.unlinkSync(licenseFile);
  }
  // Reset usage
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(usageFile, JSON.stringify({ operations: {} }));
}

function setProTier() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(licenseFile, JSON.stringify({
    key: 'CRON-TEST-TEST-TEST-TEST',
    email: 'test@test.com',
    activatedAt: new Date().toISOString()
  }));
}

// Import commands (after potential mocking)
const commands = require('../src/commands');

describe('explain command', () => {
  beforeEach(() => {
    backupFiles();
    setFreeTier();
  });

  afterEach(() => {
    restoreFiles();
  });

  it('explains valid expression', async () => {
    const result = await commands.explain.execute('0 9 * * *');
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('9'));
  });

  it('returns error for missing expression', async () => {
    const result = await commands.explain.execute();
    assert.strictEqual(result.code, 1);
  });

  it('returns error for invalid expression', async () => {
    const result = await commands.explain.execute('invalid');
    assert.strictEqual(result.code, 1);
  });

  it('supports JSON output', async () => {
    const result = await commands.explain.execute('0 9 * * *', { json: true });
    assert.strictEqual(result.code, 0);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.valid, true);
    assert.ok(json.nextRuns);
  });
});

describe('validate command', () => {
  beforeEach(() => {
    backupFiles();
    setFreeTier();
  });

  afterEach(() => {
    restoreFiles();
  });

  it('validates correct expression', async () => {
    const result = await commands.validate.execute('0 9 * * *');
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('valid'));
  });

  it('rejects invalid expression', async () => {
    const result = await commands.validate.execute('0 25 * * *');
    assert.strictEqual(result.code, 1);
    assert.ok(result.output.includes('invalid'));
  });

  it('supports strict mode warnings', async () => {
    const result = await commands.validate.execute('* * * * *', { strict: true });
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('Warning') || result.output.includes('valid'));
  });
});

describe('next command', () => {
  beforeEach(() => {
    backupFiles();
    setFreeTier();
  });

  afterEach(() => {
    restoreFiles();
  });

  it('shows next runs', async () => {
    const result = await commands.next.execute('0 * * * *');
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('run'));
  });

  it('respects count option', async () => {
    const result = await commands.next.execute('0 * * * *', { count: 3, json: true });
    assert.strictEqual(result.code, 0);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.count, 3);
  });

  it('limits to 5 runs for free tier', async () => {
    const result = await commands.next.execute('0 * * * *', { count: 100, json: true });
    assert.strictEqual(result.code, 0);
    const json = JSON.parse(result.output);
    assert.ok(json.count <= 5);
  });
});

describe('diff command', () => {
  beforeEach(() => {
    backupFiles();
    setFreeTier();
  });

  afterEach(() => {
    restoreFiles();
  });

  it('compares two expressions', async () => {
    const result = await commands.diff.execute('0 9 * * *', '0 9 * * 1-5');
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('Comparing'));
  });

  it('identifies identical expressions', async () => {
    const result = await commands.diff.execute('0 9 * * *', '0 9 * * *');
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('equivalent') || result.output.includes('Same'));
  });

  it('returns error for missing expression', async () => {
    const result = await commands.diff.execute('0 9 * * *');
    assert.strictEqual(result.code, 1);
  });
});

describe('generate command (PRO)', () => {
  beforeEach(() => {
    backupFiles();
  });

  afterEach(() => {
    restoreFiles();
  });

  it('requires PRO for generation', async () => {
    setFreeTier();
    const result = await commands.generate.execute('every monday');
    assert.strictEqual(result.code, 1);
    assert.ok(result.output.includes('PRO'));
  });

  it('shows examples without PRO', async () => {
    setFreeTier();
    const result = await commands.generate.execute('', { examples: true });
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('patterns'));
  });

  it('generates expression with PRO', async () => {
    setProTier();
    const result = await commands.generate.execute('every monday at 9am');
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('generated'));
  });
});

describe('convert command (PRO)', () => {
  beforeEach(() => {
    backupFiles();
  });

  afterEach(() => {
    restoreFiles();
  });

  it('requires PRO for conversion', async () => {
    setFreeTier();
    const result = await commands.convert.execute('0 9 * * *', { to: 'aws' });
    assert.strictEqual(result.code, 1);
    assert.ok(result.output.includes('PRO'));
  });

  it('shows formats without PRO', async () => {
    setFreeTier();
    const result = await commands.convert.execute('', { formats: true });
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('format'));
  });

  it('converts with PRO', async () => {
    setProTier();
    const result = await commands.convert.execute('0 9 * * 1-5', { to: 'aws' });
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('cron('));
  });
});

describe('license command', () => {
  beforeEach(() => {
    backupFiles();
  });

  afterEach(() => {
    restoreFiles();
  });

  it('shows free tier status', async () => {
    setFreeTier();
    const result = await commands.license.execute();
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('FREE'));
  });

  it('shows pro tier status', async () => {
    setProTier();
    const result = await commands.license.execute();
    assert.strictEqual(result.code, 0);
    assert.ok(result.output.includes('PRO'));
  });

  it('supports JSON output', async () => {
    setFreeTier();
    const result = await commands.license.execute({ json: true });
    assert.strictEqual(result.code, 0);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tier, 'free');
  });
});
