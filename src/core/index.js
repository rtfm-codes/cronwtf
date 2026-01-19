/**
 * Core cron functionality
 * @module core
 */
const parser = require('./parser');
const generator = require('./generator');
const converter = require('./converter');

module.exports = {
  // Parser
  parse: parser.parse,
  validate: parser.validate,
  describe: parser.describe,
  getNextOccurrences: parser.getNextOccurrences,
  compare: parser.compare,
  FIELDS: parser.FIELDS,
  ALIASES: parser.ALIASES,

  // Generator
  generate: generator.generate,
  parseTime: generator.parseTime,
  getExamples: generator.getExamples,

  // Converter
  toSystemd: converter.toSystemd,
  toAws: converter.toAws,
  toGitHub: converter.toGitHub,
  toQuartz: converter.toQuartz,
  toCron: converter.toCron,
  fromCron: converter.fromCron,
  detectFormat: converter.detectFormat,
  FORMATS: converter.FORMATS
};
