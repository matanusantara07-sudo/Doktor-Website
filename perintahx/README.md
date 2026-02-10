# PerintahX v1 - Autonomous WordPress Monitoring & Recovery System

**Status:** Production-ready v1 with OBSERVE_ONLY default mode

## Overview

PerintahX is an autonomous monitoring and recovery system for WordPress sites. It continuously monitors server health, WordPress API, database connectivity, disk usage, and traffic metrics, automatically taking corrective actions when issues are detected.

## Key Features

- **Autonomous Monitoring:** Continuous health checks (HTTP, WordPress API, database, disk)
- **Decision Engine:** Smart recovery logic with prioritized actions
- **Security First:** Whitelist-only command execution with fail-safe defaults
- **Immutable Audit Log:** Complete JSONL audit trail of all actions
- **Observe-Only Mode:** Safe default for monitoring without making changes
- **Kill Switch:** Emergency halt mechanism for all automated actions
- **Auto-Publishing:** Automated content publishing (when enabled and system is stable)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PerintahX v1                            │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │  Monitoring  │───>│   Decision   │───>│   Actions    │ │
│  │    Loop      │    │    Engine    │    │  (Guarded)   │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │        │
│         v                    v                    v        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │           Audit Logger (JSONL)                       │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Installation

```bash
cd perintahx

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

Edit `config.yaml` to match your environment:

```yaml
# Essential settings
mode: OBSERVE_ONLY  # Start with observe-only for safety

endpoints:
  site_url: "https://your-site.com"
  wp_api_health: "https://your-site.com/wp-json/"

security:
  whitelist_commands:
    - "systemctl restart nginx"
    - "systemctl restart php8.2-fpm"  # Adjust PHP version
    - "systemctl restart mysql"
```

**Important Configuration Questions:**

Before enabling ACTIVE mode, provide these details:

1. **Server OS:** Ubuntu/Debian/CentOS/Amazon Linux?
2. **Web Stack:** nginx + PHP-FPM version? Service names?
3. **Database:** MySQL/MariaDB/PostgreSQL? Host/port?
4. **WordPress URL:** Full site URL
5. **Auto-Publish:** WP Application Password (if enabling publishing)

### 3. Generate WordPress Application Password (Optional)

For auto-publishing feature:

1. Login to WordPress Admin
2. Go to Users > Profile
3. Scroll to "Application Passwords"
4. Create new password with name "PerintahX"
5. Copy the generated password to `config.yaml`:

```yaml
publishing:
  enabled: true
  wp_username: "your_admin_username"
  wp_app_password: "xxxx xxxx xxxx xxxx xxxx xxxx"
  article_status: "READY"
```

### 4. Run in Observe-Only Mode

```bash
# Test run (observe only, no changes)
python3 main.py
```

Monitor the output and check `audit.log.jsonl` for recorded events.

### 5. Enable Active Mode (After Testing)

After confirming observe-only mode works correctly:

```yaml
mode: ACTIVE
```

```bash
python3 main.py
```

### 6. Run as System Service (Production)

Create systemd service file `/etc/systemd/system/perintahx.service`:

```ini
[Unit]
Description=PerintahX Autonomous WordPress Monitor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/perintahx
Environment="PERINTAHX_CONFIG=/opt/perintahx/config.yaml"
ExecStart=/opt/perintahx/.venv/bin/python3 /opt/perintahx/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable perintahx
sudo systemctl start perintahx
sudo systemctl status perintahx
```

## Decision Engine Logic

The system follows this priority order:

1. **Kill Switch Check:** Halt all actions if `KILL_SWITCH` file exists
2. **Server Recovery:** If HTTP check fails → restart nginx + PHP-FPM
3. **WordPress Recovery:** If WP API fails → clear cache (v1: stub)
4. **Database Recovery:** If DB check fails → restart MySQL
5. **Disk Cleanup:** If disk usage > threshold → run logrotate
6. **SEO Diagnosis:** If traffic drops > threshold → validate sitemap
7. **Auto-Publish:** If system stable + article ready → publish to WordPress

## Safety Features

### 1. Whitelist-Only Execution

Commands MUST be in `security.whitelist_commands` to execute:

```yaml
security:
  whitelist_commands:
    - "systemctl restart nginx"  # Allowed
    # Any command not listed is DENIED
```

### 2. Observe-Only Mode

Default mode for safe monitoring:

```yaml
mode: OBSERVE_ONLY
```

All commands are logged but NOT executed.

### 3. Kill Switch

Emergency halt mechanism:

```bash
# Activate kill switch
touch KILL_SWITCH

# System will log but take NO actions until removed
rm KILL_SWITCH
```

### 4. Immutable Audit Log

All events recorded to `audit.log.jsonl`:

```json
{"timestamp":"2026-02-10T10:30:00Z","trigger":"SERVER_RECOVERY","action":"EXECUTE_CMD:systemctl restart nginx","result":"SKIPPED_OBSERVE_ONLY","verification":{}}
```

## Monitoring

### View Real-Time Logs

```bash
# Follow audit log
tail -f audit.log.jsonl | jq

# Follow system output
journalctl -u perintahx -f
```

### Check System Status

```bash
# Service status
systemctl status perintahx

# Recent audit events
tail -20 audit.log.jsonl | jq
```

### Analyze Audit Trail

```bash
# Count actions by type
jq -r '.action' audit.log.jsonl | sort | uniq -c

# Find all recovery attempts
jq 'select(.trigger | contains("RECOVERY"))' audit.log.jsonl

# Check for failures
jq 'select(.result | contains("FAIL"))' audit.log.jsonl
```

## Configuration Reference

### Mode

- `OBSERVE_ONLY`: Monitor and log only (safe default)
- `ACTIVE`: Execute recovery actions automatically

### Thresholds

```yaml
thresholds:
  disk_usage_percent_warn: 85    # Trigger cleanup
  disk_usage_percent_target: 75  # Target after cleanup
  traffic_drop_percent: 50       # Alert threshold
```

### Database

```yaml
database:
  enabled: true                  # Enable DB health checks
  host: "127.0.0.1"
  port: 3306
  connect_timeout_seconds: 2
```

### Publishing

```yaml
publishing:
  enabled: true
  wp_posts_endpoint: "https://site.com/wp-json/wp/v2/posts"
  wp_username: "admin"
  wp_app_password: "xxxx xxxx xxxx xxxx"
  article_status: "READY"  # READY | NOT_READY
```

## Troubleshooting

### "Config file not found"

```bash
# Set config path explicitly
export PERINTAHX_CONFIG=/path/to/config.yaml
python3 main.py
```

### Commands not executing in ACTIVE mode

1. Check command is in whitelist
2. Verify mode is set to `ACTIVE` in config
3. Check audit log for denial reasons:

```bash
jq 'select(.result | contains("DENIED"))' audit.log.jsonl
```

### Permission denied errors

Run as root or user with systemctl permissions:

```bash
sudo python3 main.py
```

### Database check failing

Verify database is running and accessible:

```bash
# MySQL/MariaDB
mysql -h 127.0.0.1 -P 3306 -u root -p -e "SELECT 1"

# Check config
grep -A5 "database:" config.yaml
```

## Roadmap (Future Versions)

- **v1.1:** Google Analytics & Search Console integration
- **v1.2:** Advanced cache management (Redis, Memcached)
- **v1.3:** WordPress plugin auto-disable on errors
- **v1.4:** Email/Slack/webhook alerts
- **v1.5:** Machine learning anomaly detection

## Security Considerations

1. **Run as Dedicated User:** Create limited-privilege user for production
2. **Secure Credentials:** Use environment variables for sensitive data
3. **Audit Regularly:** Review `audit.log.jsonl` for unexpected actions
4. **Test First:** Always run in OBSERVE_ONLY mode initially
5. **Whitelist Minimal Commands:** Only add commands you fully understand

## Support

For issues or questions:

1. Check audit log: `tail audit.log.jsonl | jq`
2. Verify configuration: `python3 -c "import yaml; print(yaml.safe_load(open('config.yaml')))"`
3. Test connectivity: `curl -I https://your-site.com/wp-json/`

## License

MIT License - Use at your own risk. Test thoroughly before production deployment.

## Credits

Built for autonomous WordPress infrastructure management with security and reliability as top priorities.
