# cronwtf

Cron expression decoder & generator. wtf does this cron do?

[![npm](https://img.shields.io/npm/v/cronwtf)](https://www.npmjs.com/package/cronwtf)
[![license](https://img.shields.io/npm/l/cronwtf)](https://rtfm.codes/cronwtf/license)

**[Documentation](https://rtfm.codes/cronwtf)** | **[Get PRO](https://rtfm.codes/cronwtf/pro)** | **[Report Bug](https://rtfm.codes/cronwtf/issues)** | **[All Tools](https://rtfm.codes)**

## Install

```bash
npm install -g cronwtf
```

## Quick Start

```bash
# explain a cron expression
cronwtf "*/15 * * * *"
# Every 15 minutes

# validate expression
cronwtf validate "0 25 * * *"
# invalid: hour out of range

# show next runs
cronwtf next "0 9 * * 1-5"

# compare two expressions
cronwtf diff "0 9 * * *" "0 9 * * 1-5"

# generate from text (PRO)
cronwtf generate "every monday at 9am"

# convert formats (PRO)
cronwtf convert "0 9 * * 1-5" --to aws
```

## Commands

### FREE Commands

| Command | Description | Example |
|---------|-------------|---------|
| `explain` | Explain cron expression (default) | `cronwtf "*/15 * * * *"` |
| `validate` | Check if expression is valid | `cronwtf validate "0 9 * * *"` |
| `next` | Show next run times | `cronwtf next "0 9 * * *"` |
| `diff` | Compare two expressions | `cronwtf diff "0 9 * * *" "0 9 * * 1-5"` |

### PRO Commands

| Command | Description | Example |
|---------|-------------|---------|
| `generate` | Generate from plain English | `cronwtf generate "every monday at 9am"` |
| `convert` | Convert between formats | `cronwtf convert "0 9 * * *" --to aws` |
| `calendar` | Export to iCal | `cronwtf calendar "0 9 * * 1-5" -o work.ics` |
| `test` | Test against dates | `cronwtf test "0 9 * * *" --date "2024-12-25"` |
| `interactive` | Build step-by-step | `cronwtf interactive` |

[Get PRO](https://rtfm.codes/cronwtf/pro) - One-time $8.99, no subscriptions.

## Usage

### Explain Cron

```bash
# default command
cronwtf "*/15 * * * *"
# Every 15 minutes

cronwtf "0 9 * * 1-5"
# At minute 0 at 9AM on weekdays

cronwtf "@daily"
# Every day at midnight

# JSON output
cronwtf "0 9 * * *" --json
```

### Validate

```bash
cronwtf validate "0 9 * * *"
# valid cron expression. nice.

cronwtf validate "0 25 * * *"
# invalid: hour values out of range (25)

# strict mode for edge case warnings
cronwtf validate "* * * * *" --strict
```

### Next Runs

```bash
# show next 5 runs
cronwtf next "0 9 * * *"

# show more runs
cronwtf next "0 9 * * *" -c 10

# different timezone (PRO)
cronwtf next "0 9 * * *" --timezone America/New_York
```

### Compare

```bash
cronwtf diff "0 9 * * *" "0 9 * * 1-5"
# Shows differences and overlap
```

### Generate (PRO)

```bash
cronwtf generate "every 5 minutes"
# */5 * * * *

cronwtf generate "every monday at 9am"
# 0 9 * * 1

cronwtf generate "first day of month at midnight"
# 0 0 1 * *

# show common patterns
cronwtf generate --examples
```

### Convert (PRO)

```bash
# to AWS CloudWatch
cronwtf convert "0 9 * * 1-5" --to aws
# cron(0 9 ? * 2-6 *)

# to GitHub Actions
cronwtf convert "0 9 * * 1-5" --to github

# to systemd
cronwtf convert "0 9 * * 1-5" --to systemd

# from AWS to standard cron
cronwtf convert "cron(0 9 ? * 2-6 *)" --from aws

# supported formats
cronwtf convert --formats
```

### Calendar Export (PRO)

```bash
# export to iCal file
cronwtf calendar "0 9 * * 1-5" -o standup.ics -n "Daily Standup"

# preview without exporting
cronwtf calendar "0 9 * * 1-5" --preview
```

### Test Dates (PRO)

```bash
# test single date
cronwtf test "0 9 * * 1-5" --date "2024-12-25 09:00"

# test date range
cronwtf test "0 9 * * *" --range "2024-01-01..2024-01-07"
```

### License Management

```bash
# show status
cronwtf license

# activate PRO
cronwtf license --key YOUR_LICENSE_KEY

# deactivate
cronwtf license --deactivate
```

## Programmatic API

```javascript
const cronwtf = require('cronwtf');

// Parse and validate
const parsed = cronwtf.parse('0 9 * * 1-5');
const { valid, errors } = cronwtf.validate('0 9 * * *');

// Get description
const desc = cronwtf.describe('*/15 * * * *');
// "Every 15 minutes"

// Get next occurrences
const next = cronwtf.getNextOccurrences('0 9 * * *', 5);

// Compare expressions
const diff = cronwtf.compare('0 9 * * *', '0 9 * * 1-5');

// Generate from text (PRO)
const { expression } = cronwtf.generate('every monday at 9am');

// Convert formats (PRO)
const aws = cronwtf.toAws('0 9 * * 1-5');
const github = cronwtf.toGitHub('0 9 * * 1-5');
```

## Free vs PRO

| Feature | FREE | PRO |
|---------|------|-----|
| Explain expressions | Unlimited | Unlimited |
| Validate expressions | Unlimited | Unlimited |
| Compare expressions | Unlimited | Unlimited |
| Next runs | 5 runs | **100 runs** |
| Daily operations | 10/day | **Unlimited** |
| Timezones | Local only | **All timezones** |
| Generate from text | - | **Included** |
| Format conversion | - | **All formats** |
| Calendar export | - | **iCal/Google** |
| Date testing | - | **Included** |
| Interactive builder | - | **Included** |
| Price | Free | **$8.99** (one-time) |

[Get PRO](https://rtfm.codes/cronwtf/pro) - Unlimited everything. One-time purchase. No subscriptions.

## Cron Format Reference

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12 or jan-dec)
│ │ │ │ ┌───────────── day of week (0-7, 0 and 7 are Sunday)
│ │ │ │ │
* * * * *
```

### Special Characters

| Character | Description | Example |
|-----------|-------------|---------|
| `*` | Any value | `* * * * *` (every minute) |
| `,` | List | `0,30 * * * *` (at 0 and 30) |
| `-` | Range | `0 9-17 * * *` (9am-5pm) |
| `/` | Step | `*/15 * * * *` (every 15) |

### Aliases

| Alias | Equivalent |
|-------|------------|
| `@yearly` | `0 0 1 1 *` |
| `@monthly` | `0 0 1 * *` |
| `@weekly` | `0 0 * * 0` |
| `@daily` | `0 0 * * *` |
| `@hourly` | `0 * * * *` |
| `@reboot` | Run at startup |

## More from rtfm.codes

- **[regexplain](https://rtfm.codes/regexplain)** - Regex pattern explainer
- **[httpwut](https://rtfm.codes/httpwut)** - HTTP status code reference
- **[gitwtf](https://rtfm.codes/gitwtf)** - Git command explainer
- **[jsonyo](https://rtfm.codes/jsonyo)** - JSON swiss army knife
- **[portyo](https://rtfm.codes/portyo)** - Port management CLI

**[View all tools](https://rtfm.codes)**

## License

MIT (c) [rtfm.codes](https://rtfm.codes)

---

**[rtfm.codes](https://rtfm.codes)** - read the friendly manual
