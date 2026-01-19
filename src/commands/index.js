/**
 * CLI Commands
 * @module commands
 */

module.exports = {
  // FREE commands
  explain: require('./explain'),
  validate: require('./validate'),
  next: require('./next'),
  diff: require('./diff'),

  // PRO commands
  generate: require('./generate'),
  convert: require('./convert'),
  calendar: require('./calendar'),
  test: require('./test'),
  interactive: require('./interactive'),

  // License management
  license: require('./license')
};
