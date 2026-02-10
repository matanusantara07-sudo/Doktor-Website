# Doktor-Website

Aplikasi Alat Service Website Media Online yang memudahkan pemilik website memperbaiki performa agar cepat dan responsif. Dilengkapi deteksi dan penghapusan virus serta antivirus bawaan. Cukup masukkan nama website, sistem menganalisis kerusakan dan menyediakan fitur Perbaiki Otomatis untuk semua masalah website media online.

## Features

- **User Management** — Create, delete, update roles, reset passwords (RBAC-enforced)
- **Content Management** — Full editorial workflow: submit → edit → approve/reject → publish
- **Social Media Auto-Publication** — Publish to Twitter, Facebook, Instagram, LinkedIn, TikTok with scheduling
- **WordPress Integration** — Upload drafts to WordPress, manage post status, check connection
- **Server & Service Monitoring** — Ping servers, check APIs, monitor service health
- **Alert & Notification** — Email, SMS, Webhook, Telegram alerts with enable/disable/test
- **Auto-Fix Engine** — Restart services, clear cache, reconnect APIs, refresh tokens
- **Analytics & Ads** — Check pageviews, sessions, bounce rate, ad campaigns, AdSense
- **Audit Log** — Full audit trail with filtering and export (JSON, CSV, TXT)

## Roles

| Role           | Description                          |
|----------------|--------------------------------------|
| `Reporter`     | Submit and edit own drafts           |
| `Redaktur`     | Edit, approve, reject drafts         |
| `Pemred`       | Chief editor; approve, reject, publish |
| `Admin_Teknis` | Full system access                   |

## Requirements

- Node.js >= 18.0.0

## Quick Start

```bash
# 1. Seed default users
node src/seed.js

# 2. Show help
node src/index.js --help

# 3. List users (as admin)
node src/index.js --user admin LIST_USERS

# 4. Run tests
npm test
```

## Usage

```
node src/index.js --user <username> <COMMAND> [args...]
node src/index.js --user <username> --json <COMMAND> [args...]
```

### Options

| Flag         | Description                              |
|--------------|------------------------------------------|
| `--user, -u` | Username of the caller (required)        |
| `--json`     | Output result as JSON                    |
| `--help, -h` | Show help with all available commands    |

## Commands Reference

### User Management (Admin_Teknis)

```bash
CREATE_USER <username> <email> <role>
DELETE_USER <username>
UPDATE_USER_ROLE <username> <new_role>
RESET_PASSWORD <username>
LIST_USERS
```

### Content Management

```bash
SUBMIT_DRAFT <draft_id> <title> <content> [author]    # Reporter+
EDIT_DRAFT <draft_id> <field>=<value>                  # Reporter+
APPROVE_DRAFT <draft_id>                               # Redaktur+
REJECT_DRAFT <draft_id> <reason>                       # Redaktur+
LIST_DRAFTS [status]                                   # Redaktur+
```

### Social Media (Pemred / Admin_Teknis)

```bash
PUBLISH_SOCIAL <draft_id> <platform_list> [schedule_time]
RETRY_PUBLISH <draft_id> <platform_list>
CHECK_STATUS <draft_id> [platform]                     # All roles
```

### WordPress Integration (Admin_Teknis)

```bash
UPLOAD_WP <draft_id>
UPDATE_WP_STATUS <draft_id> <status>
CHECK_WP_CONNECTION
```

### Monitoring (Admin_Teknis)

```bash
PING_SERVER <server_url>
CHECK_API <api_url>
CHECK_SERVICE <service_name> <server_url>
LIST_SERVERS
LIST_SERVICES
```

### Alerts (Admin_Teknis)

```bash
ENABLE_ALERT <type> <recipient>
DISABLE_ALERT <type> <recipient>
LIST_ALERTS
TEST_ALERT <type> <recipient>
```

### Auto-Fix Engine (Admin_Teknis)

```bash
RESTART_SERVICE <service_name> <server_url>
CLEAR_CACHE <server_url>
RECONNECT_API <api_url>
REFRESH_TOKEN <platform>
EXECUTE_FIX <fix_id>
LIST_FIXES
```

### Analytics & Ads (Admin_Teknis)

```bash
CHECK_ANALYTICS <metric> <platform>
CHECK_ADS <campaign_id>
CHECK_ADSENSE <site_id>
LIST_METRICS
```

### Audit Log (Admin_Teknis)

```bash
LIST_LOGS [date_range]              # e.g. 2026-02-10 or 2026-02-01:2026-02-10
FILTER_LOGS <user|module|action>=<value>
EXPORT_LOGS <format>                # json, csv, txt
```

## Example Workflow

```bash
# Reporter submits a draft
node src/index.js --user reporter1 SUBMIT_DRAFT D001 "Breaking News" "Full article content" reporter1

# Redaktur edits the title
node src/index.js --user redaktur1 EDIT_DRAFT D001 title="Breaking News: Updated"

# Pemred approves the draft
node src/index.js --user pemred1 APPROVE_DRAFT D001

# Pemred publishes to social media
node src/index.js --user pemred1 PUBLISH_SOCIAL D001 twitter,facebook,instagram

# Admin uploads to WordPress
node src/index.js --user admin UPLOAD_WP D001

# Reporter checks social media status
node src/index.js --user reporter1 CHECK_STATUS D001
```

## Project Structure

```
src/
├── index.js          # CLI entry point & command router
├── config.js         # Configuration management
├── database.js       # JSON file-based data store
├── auth.js           # Authentication & RBAC
├── logger.js         # Structured logging
├── seed.js           # Database seeder
└── modules/
    ├── users.js      # User Management
    ├── content.js    # Content/Draft Management
    ├── social.js     # Social Media Auto-Publication
    ├── wordpress.js  # WordPress Integration
    ├── monitoring.js # Server & Service Monitoring
    ├── alerts.js     # Alert & Notification
    ├── autofix.js    # Auto-Fix Engine
    ├── analytics.js  # Analytics & Ads
    └── audit.js      # Audit Log
data/                 # JSON data store (auto-created)
tests/                # Test suite
```

## Testing

```bash
npm test
```

Runs 66 tests across 11 suites covering all modules, RBAC enforcement, and full editorial workflows.

## License

MIT — see [LICENSE](LICENSE)
