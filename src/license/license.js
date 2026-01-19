/**
 * License management
 * @module license/license
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// License file location
const CONFIG_DIR = path.join(os.homedir(), '.cronwtf');
const LICENSE_FILE = path.join(CONFIG_DIR, 'license.json');
const USAGE_FILE = path.join(CONFIG_DIR, 'usage.json');

// Lemon Squeezy API
const LEMON_API_BASE = 'https://api.lemonsqueezy.com/v1';
const STORE_ID = 'cronwtf'; // Replace with actual store ID in production

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Read license data from file
 * @returns {Object|null} License data or null
 */
function readLicenseFile() {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf8'));
    }
  } catch (e) {
    // Invalid file, ignore
  }
  return null;
}

/**
 * Write license data to file
 * @param {Object} data - License data
 */
function writeLicenseFile(data) {
  ensureConfigDir();
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Validate license key with Lemon Squeezy
 * @param {string} key - License key
 * @returns {Promise<Object>} Validation result
 */
async function validateLicenseKey(key) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      license_key: key,
      instance_name: os.hostname()
    });

    const options = {
      hostname: 'api.lemonsqueezy.com',
      port: 443,
      path: '/v1/licenses/activate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Accept': 'application/json'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.activated || response.valid) {
            resolve({
              valid: true,
              license: {
                key,
                email: response.meta?.customer_email || 'unknown',
                activatedAt: new Date().toISOString(),
                instanceId: response.instance?.id || os.hostname()
              }
            });
          } else {
            resolve({
              valid: false,
              error: response.error || 'Invalid license key'
            });
          }
        } catch (e) {
          // If API is unavailable, do offline validation
          resolve(offlineValidate(key));
        }
      });
    });

    req.on('error', () => {
      // Network error - do offline validation
      resolve(offlineValidate(key));
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(offlineValidate(key));
    });

    req.write(data);
    req.end();
  });
}

/**
 * Offline validation (basic format check)
 * @param {string} key - License key
 * @returns {Object} Validation result
 */
function offlineValidate(key) {
  // Basic format: CRON-XXXX-XXXX-XXXX-XXXX
  const pattern = /^CRON-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
  if (pattern.test(key)) {
    return {
      valid: true,
      offline: true,
      license: {
        key,
        email: 'offline@validation',
        activatedAt: new Date().toISOString(),
        instanceId: os.hostname()
      }
    };
  }
  return {
    valid: false,
    error: 'Invalid license key format'
  };
}

/**
 * Activate a license key
 * @param {string} key - License key
 * @returns {Promise<Object>} Activation result
 */
async function activateLicense(key) {
  const validation = await validateLicenseKey(key);

  if (validation.valid) {
    writeLicenseFile(validation.license);
    return {
      success: true,
      message: 'License activated successfully!',
      email: validation.license.email,
      offline: validation.offline
    };
  }

  return {
    success: false,
    error: validation.error
  };
}

/**
 * Deactivate current license
 * @returns {Object} Deactivation result
 */
function deactivateLicense() {
  const license = readLicenseFile();

  if (!license) {
    return {
      success: false,
      error: 'No active license found'
    };
  }

  try {
    fs.unlinkSync(LICENSE_FILE);
    return {
      success: true,
      message: 'License deactivated'
    };
  } catch (e) {
    return {
      success: false,
      error: 'Failed to deactivate license'
    };
  }
}

/**
 * Get current license status
 * @returns {Object} License status
 */
function getLicenseStatus() {
  const license = readLicenseFile();

  if (license && license.key) {
    return {
      tier: 'pro',
      active: true,
      email: license.email,
      activatedAt: license.activatedAt
    };
  }

  return {
    tier: 'free',
    active: false
  };
}

/**
 * Check if user has PRO
 * @returns {boolean}
 */
function isPro() {
  return getLicenseStatus().tier === 'pro';
}

module.exports = {
  activateLicense,
  deactivateLicense,
  getLicenseStatus,
  isPro,
  validateLicenseKey,
  CONFIG_DIR,
  LICENSE_FILE,
  USAGE_FILE
};
