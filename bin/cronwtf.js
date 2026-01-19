#!/usr/bin/env node
/**
 * CRONWTF CLI
 * Cron expression decoder and generator
 * https://rtfm.codes/cronwtf
 */
const commands = require('../src/commands');
const { dim, bold, cyan, proBadge } = require('../src/utils');
const pkg = require('../package.json');

/**
 * Parse command line arguments
 * @param {Array} args - Process arguments
 * @returns {Object} Parsed args
 */
function parseArgs(args) {
  const result = {
    command: null,
    args: [],
    options: {}
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      // Check for --key=value format
      if (key.includes('=')) {
        const [k, v] = key.split('=');
        result.options[k] = v;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.options[key] = args[i + 1];
        i++;
      } else {
        result.options[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const shortMap = {
        'v': 'validate',
        'n': 'next',
        'g': 'generate',
        'c': 'count',
        't': 'timezone',
        'o': 'output',
        'i': 'interactive',
        'h': 'help',
        'V': 'version'
      };
      const key = shortMap[arg[1]] || arg[1];

      // Some short flags take values
      if (['c', 't', 'o', 'n'].includes(arg[1]) && i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.options[key] = args[i + 1];
        i++;
      } else if (['v', 'g', 'i'].includes(arg[1])) {
        // These are command shortcuts
        if (!result.command) {
          result.command = key;
        }
      } else {
        result.options[key] = true;
      }
    } else if (!result.command && !arg.match(/^[\d\*\/\-\,\@]/)) {
      // First non-option, non-cron arg is the command
      result.command = arg;
    } else {
      result.args.push(arg);
    }
    i++;
  }

  return result;
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
  ${bold('CRONWTF')} - cron expression decoder & generator
  ${dim(`v${pkg.version} | https://rtfm.codes/cronwtf`)}

  ${bold('Usage:')}
    cronwtf <expression>              explain cron expression
    cronwtf <command> [options]       run a command

  ${bold('FREE Commands:')}
    explain <expr>    explain what a cron does (default)
    validate <expr>   check if cron is valid
    next <expr>       show next run times
    diff <a> <b>      compare two expressions

  ${bold('PRO Commands:')} ${proBadge()}
    generate <text>   generate cron from plain English
    convert <expr>    convert between formats (AWS, systemd, GitHub)
    calendar <expr>   export schedule to iCal
    test <expr>       test against specific dates
    interactive       build cron step by step

  ${bold('Other:')}
    license           show/manage PRO license
    --help, -h        show this help
    --version, -V     show version

  ${bold('Examples:')}
    cronwtf "*/15 * * * *"
    cronwtf "0 9 * * 1-5"
    cronwtf validate "0 25 * * *"
    cronwtf next "0 9 * * *" -c 10
    cronwtf generate "every monday at 9am"      ${proBadge()}
    cronwtf convert "0 9 * * 1-5" --to aws      ${proBadge()}

  ${dim('Get PRO: https://rtfm.codes/cronwtf/pro ($8.99 one-time)')}
`);
}

/**
 * Show version
 */
function showVersion() {
  console.log(`cronwtf v${pkg.version}`);
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // No args - show help
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const parsed = parseArgs(args);

  // Help flag
  if (parsed.options.help || parsed.options.h) {
    if (parsed.command && commands[parsed.command]) {
      console.log(commands[parsed.command].help());
    } else {
      showHelp();
    }
    process.exit(0);
  }

  // Version flag
  if (parsed.options.version || parsed.options.V) {
    showVersion();
    process.exit(0);
  }

  // Determine command
  let command = parsed.command;
  let cmdArgs = parsed.args;

  // If first arg looks like a cron expression, default to explain
  if (!command && cmdArgs.length > 0 && cmdArgs[0].match(/^[\d\*\/\-\,\@]/)) {
    command = 'explain';
  } else if (!command && cmdArgs.length === 0 && Object.keys(parsed.options).length === 0) {
    showHelp();
    process.exit(0);
  }

  // Interactive shortcut
  if (parsed.options.interactive === true) {
    command = 'interactive';
  }

  // Find and execute command
  const cmd = commands[command];
  if (!cmd) {
    // Maybe it's a cron expression passed directly
    if (command && command.match(/^[\d\*\/\-\,\@]/)) {
      cmdArgs.unshift(command);
      command = 'explain';
    } else {
      console.error(`Unknown command: ${command}`);
      console.error('Run "cronwtf --help" for usage.');
      process.exit(1);
    }
  }

  try {
    let result;

    // Route to appropriate command
    switch (command) {
      case 'explain':
        result = await commands.explain.execute(cmdArgs[0], parsed.options);
        break;

      case 'validate':
        result = await commands.validate.execute(cmdArgs[0], parsed.options);
        break;

      case 'next':
        result = await commands.next.execute(cmdArgs[0], {
          ...parsed.options,
          count: parseInt(parsed.options.count || parsed.options.c || '5', 10)
        });
        break;

      case 'diff':
        result = await commands.diff.execute(cmdArgs[0], cmdArgs[1], parsed.options);
        break;

      case 'generate':
        result = await commands.generate.execute(cmdArgs.join(' '), parsed.options);
        break;

      case 'convert':
        result = await commands.convert.execute(cmdArgs[0], parsed.options);
        break;

      case 'calendar':
        result = await commands.calendar.execute(cmdArgs[0], {
          ...parsed.options,
          count: parseInt(parsed.options.count || '30', 10)
        });
        break;

      case 'test':
        result = await commands.test.execute(cmdArgs[0], parsed.options);
        break;

      case 'interactive':
        result = await commands.interactive.execute(parsed.options);
        break;

      case 'license':
        result = await commands.license.execute(parsed.options);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    // Output result
    if (result.output) {
      console.log(result.output);
    }

    process.exit(result.code);

  } catch (err) {
    console.error(`Error: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run
main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
