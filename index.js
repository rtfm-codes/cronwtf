/**
 * CRONWTF - Programmatic API
 * https://rtfm.codes/cronwtf
 *
 * @example
 * const cronwtf = require('cronwtf');
 *
 * // Parse and validate
 * const parsed = cronwtf.parse('0 9 * * 1-5');
 * const isValid = cronwtf.validate('0 9 * * *').valid;
 *
 * // Get description
 * const desc = cronwtf.describe('*/15 * * * *');
 * // "Every 15 minutes"
 *
 * // Get next occurrences
 * const next = cronwtf.getNextOccurrences('0 9 * * *', 5);
 *
 * // Compare expressions
 * const diff = cronwtf.compare('0 9 * * *', '0 9 * * 1-5');
 *
 * // Generate from text (PRO)
 * const generated = cronwtf.generate('every monday at 9am');
 *
 * // Convert formats (PRO)
 * const aws = cronwtf.toAws('0 9 * * 1-5');
 */

const core = require('./src/core');
const license = require('./src/license');

module.exports = {
  // Parsing and validation
  parse: core.parse,
  validate: core.validate,
  describe: core.describe,

  // Scheduling
  getNextOccurrences: core.getNextOccurrences,
  compare: core.compare,

  // Generation
  generate: core.generate,
  getExamples: core.getExamples,

  // Conversion
  toAws: core.toAws,
  toSystemd: core.toSystemd,
  toGitHub: core.toGitHub,
  toQuartz: core.toQuartz,
  toCron: core.toCron,
  fromCron: core.fromCron,
  detectFormat: core.detectFormat,

  // License
  isPro: license.isPro,
  getLicenseStatus: license.getLicenseStatus,

  // Constants
  FIELDS: core.FIELDS,
  ALIASES: core.ALIASES,
  FORMATS: core.FORMATS,

  // Version
  version: require('./package.json').version
};
