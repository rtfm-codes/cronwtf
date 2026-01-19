/**
 * Cross-promotion for rtfm.codes tools
 * @module utils/promo
 */
const { dim, cyan, bold } = require('./output');

// Cross-promo chance (10%)
const PROMO_CHANCE = 0.1;

// Other rtfm.codes tools
const TOOLS = [
  {
    name: 'regexplain',
    description: 'Explain regex patterns in plain English',
    url: 'https://rtfm.codes/regexplain',
    tagline: 'regex got you confused?'
  },
  {
    name: 'httpwut',
    description: 'HTTP status code reference + explanations',
    url: 'https://rtfm.codes/httpwut',
    tagline: 'what does 418 mean again?'
  },
  {
    name: 'gitwtf',
    description: 'Git command explainer + fixer',
    url: 'https://rtfm.codes/gitwtf',
    tagline: 'git yourself out of trouble'
  },
  {
    name: 'jsonyo',
    description: 'JSON swiss army knife',
    url: 'https://rtfm.codes/jsonyo',
    tagline: 'json processing, simplified'
  },
  {
    name: 'licenseme',
    description: 'Pick the right license for your project',
    url: 'https://rtfm.codes/licenseme',
    tagline: 'which license should i use?'
  },
  {
    name: 'portyo',
    description: 'Port management CLI',
    url: 'https://rtfm.codes/portyo',
    tagline: 'who is using port 3000?'
  }
];

/**
 * Get random promotion (10% chance)
 * @returns {string|null}
 */
function getPromo() {
  // 10% chance
  if (Math.random() > PROMO_CHANCE) {
    return null;
  }

  const tool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
  return formatPromo(tool);
}

/**
 * Format promotion message
 * @param {Object} tool - Tool data
 * @returns {string}
 */
function formatPromo(tool) {
  let output = '\n\n';
  output += dim('─'.repeat(40)) + '\n';
  output += dim(tool.tagline) + '\n';
  output += `${bold(tool.name)} - ${tool.description}\n`;
  output += cyan(tool.url);
  return output;
}

/**
 * Get all tools list
 * @returns {string}
 */
function getAllTools() {
  let output = bold('More from rtfm.codes:\n\n');

  TOOLS.forEach(tool => {
    output += `  ${bold(tool.name.padEnd(12))} ${tool.description}\n`;
    output += `  ${dim(''.padEnd(12))} ${cyan(tool.url)}\n\n`;
  });

  output += dim('All tools: ') + cyan('https://rtfm.codes');
  return output;
}

module.exports = {
  getPromo,
  formatPromo,
  getAllTools,
  TOOLS,
  PROMO_CHANCE
};
