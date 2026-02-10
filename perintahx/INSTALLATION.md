# PerintahX v1 - Installation Guide

## Prerequisites

- Python 3.8+
- systemd-based Linux (Ubuntu, Debian, CentOS, Amazon Linux, etc.)
- Root or sudo access
- Running WordPress site with REST API enabled

## Step-by-Step Installation

### 1. System Preparation

```bash
# Update system
sudo apt update  # Ubuntu/Debian
# OR
sudo yum update  # CentOS/Amazon Linux

# Install Python 3 and pip
sudo apt install python3 python3-pip python3-venv  # Ubuntu/Debian
# OR
sudo yum install python3 python3-pip  # CentOS/Amazon Linux
```

### 2. Download PerintahX

```bash
# Create installation directory
sudo mkdir -p /opt/perintahx
cd /opt/perintahx

# Copy files (if from git)
git clone <your-repo-url> .

# OR manually copy files:
# - main.py
# - config.yaml
# - requirements.txt
# - run.sh
```

### 3. Configure for Your Environment

#### A. Identify Your Stack

```bash
# Check web server
systemctl status nginx
# OR
systemctl status apache2

# Check PHP-FPM version and service name
systemctl list-units | grep php
# Common names: php8.2-fpm, php8.1-fpm, php-fpm

# Check database
systemctl status mysql
# OR
systemctl status mariadb
# OR
systemctl status postgresql
```

#### B. Edit Configuration

```bash
cd /opt/perintahx
nano config.yaml
```

**Minimum Required Changes:**

```yaml
mode: OBSERVE_ONLY  # Keep this for initial testing!

endpoints:
  site_url: "https://YOUR-ACTUAL-DOMAIN.com"
  wp_api_health: "https://YOUR-ACTUAL-DOMAIN.com/wp-json/"
  http_check_url: "https://YOUR-ACTUAL-DOMAIN.com/"

security:
  whitelist_commands:
    - "systemctl restart nginx"        # OR apache2
    - "systemctl restart php8.2-fpm"   # Match YOUR PHP version
    - "systemctl restart mysql"        # OR mariadb/postgresql
    - "logrotate -f /etc/logrotate.conf"
```

**Optional: Enable Database Checks**

```yaml
database:
  enabled: true
  host: "127.0.0.1"
  port: 3306  # MySQL/MariaDB default (5432 for PostgreSQL)
```

**Optional: Enable Auto-Publishing**

First, generate WordPress Application Password:

1. Login to WordPress Admin
2. Users → Profile → Application Passwords
3. Name: "PerintahX"
4. Click "Add New Application Password"
5. Copy the generated password

Then configure:

```yaml
publishing:
  enabled: true
  wp_posts_endpoint: "https://YOUR-DOMAIN.com/wp-json/wp/v2/posts"
  wp_username: "your_wp_admin_username"
  wp_app_password: "xxxx xxxx xxxx xxxx xxxx xxxx"
  article_status: "NOT_READY"  # Change to READY when you want auto-publish
```

### 4. Install Dependencies

```bash
cd /opt/perintahx

# Create virtual environment
python3 -m venv .venv

# Activate
source .venv/bin/activate

# Install packages
pip install -r requirements.txt

# Verify installation
python3 -c "import requests, yaml, psutil; print('Dependencies OK')"
```

### 5. Test in Observe-Only Mode

```bash
# Make run script executable
chmod +x run.sh

# Test run (Ctrl+C to stop)
sudo ./run.sh

# Check audit log
tail -f audit.log.jsonl
```

**Expected Output:**

```
[2026-02-10T10:30:00Z] PerintahX v1 started in OBSERVE_ONLY mode
[2026-02-10T10:30:01Z] Health check: server=True, wp=True, db=True, disk=25.3%
```

**Verify in Audit Log:**

```bash
# Should show SKIPPED_OBSERVE_ONLY for all commands
jq 'select(.action | contains("EXECUTE_CMD"))' audit.log.jsonl
```

### 6. Install as System Service

Create systemd service file:

```bash
sudo nano /etc/systemd/system/perintahx.service
```

**Service Configuration:**

```ini
[Unit]
Description=PerintahX Autonomous WordPress Monitor
After=network.target mysql.service nginx.service
Wants=mysql.service nginx.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/perintahx
Environment="PERINTAHX_CONFIG=/opt/perintahx/config.yaml"
ExecStart=/opt/perintahx/.venv/bin/python3 /opt/perintahx/main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Security hardening (optional)
NoNewPrivileges=false
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

**Enable and Start Service:**

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable perintahx

# Start service
sudo systemctl start perintahx

# Check status
sudo systemctl status perintahx
```

### 7. Monitor and Verify

```bash
# Follow real-time logs
sudo journalctl -u perintahx -f

# Check audit log
sudo tail -f /opt/perintahx/audit.log.jsonl | jq

# Verify health checks are running
sudo jq 'select(.action == "CHECKS_SNAPSHOT")' /opt/perintahx/audit.log.jsonl | tail -1
```

### 8. Enable Active Mode (After Testing)

**IMPORTANT:** Only enable after verifying observe-only mode works correctly!

```bash
sudo nano /opt/perintahx/config.yaml
```

Change:
```yaml
mode: ACTIVE
```

Restart service:
```bash
sudo systemctl restart perintahx
sudo systemctl status perintahx
```

## Verification Checklist

- [ ] Python 3.8+ installed
- [ ] Dependencies installed in virtual environment
- [ ] config.yaml customized for your server
- [ ] Web server service name correct in whitelist
- [ ] PHP-FPM service name correct in whitelist
- [ ] Database service name correct in whitelist
- [ ] WordPress API accessible (test: `curl https://your-site.com/wp-json/`)
- [ ] Observe-only mode tested successfully
- [ ] Systemd service enabled and running
- [ ] Audit log showing regular health checks
- [ ] No errors in `journalctl -u perintahx`

## Quick Validation Tests

### Test 1: HTTP Check
```bash
curl -I https://your-site.com/
# Should return 200 OK
```

### Test 2: WordPress API Check
```bash
curl -I https://your-site.com/wp-json/
# Should return 200 OK with JSON content
```

### Test 3: Database Connection (if enabled)
```bash
# MySQL/MariaDB
mysql -h 127.0.0.1 -P 3306 -u root -p -e "SELECT 1"

# PostgreSQL
psql -h 127.0.0.1 -p 5432 -U postgres -c "SELECT 1"
```

### Test 4: Systemctl Commands
```bash
# Verify commands in whitelist work
sudo systemctl status nginx
sudo systemctl status php8.2-fpm  # Match your version
sudo systemctl status mysql
```

### Test 5: Kill Switch
```bash
# Activate kill switch
sudo touch /opt/perintahx/KILL_SWITCH

# Check logs (should show "KILL SWITCH TRIGGERED")
sudo journalctl -u perintahx -n 50

# Deactivate
sudo rm /opt/perintahx/KILL_SWITCH
```

## Common Installation Issues

### Issue: "Config file not found"

**Solution:**
```bash
# Check file exists
ls -l /opt/perintahx/config.yaml

# Set explicit path
export PERINTAHX_CONFIG=/opt/perintahx/config.yaml
```

### Issue: "ModuleNotFoundError: No module named 'requests'"

**Solution:**
```bash
# Activate virtual environment
cd /opt/perintahx
source .venv/bin/activate
pip install -r requirements.txt
```

### Issue: "Permission denied" when running commands

**Solution:**
```bash
# Run as root or use sudo
sudo ./run.sh

# OR add user to sudoers with NOPASSWD for specific commands
```

### Issue: WordPress API returns 404

**Solution:**
```bash
# Check permalinks in WordPress
# Go to Settings → Permalinks → Save Changes

# Test API
curl https://your-site.com/wp-json/

# Check .htaccess or nginx config for REST API routes
```

### Issue: Service fails to start

**Solution:**
```bash
# Check detailed logs
sudo journalctl -u perintahx -xe

# Verify paths in service file
sudo systemctl cat perintahx

# Test manual run
cd /opt/perintahx
source .venv/bin/activate
sudo python3 main.py
```

## Next Steps

After successful installation:

1. **Monitor for 24 hours** in OBSERVE_ONLY mode
2. **Review audit log** for any issues
3. **Enable ACTIVE mode** if all checks pass
4. **Set up log rotation** (logs can grow large)
5. **Configure alerts** (email/Slack - see README.md)

## Log Rotation Setup

```bash
sudo nano /etc/logrotate.d/perintahx
```

```
/opt/perintahx/audit.log.jsonl {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    copytruncate
}
```

Test:
```bash
sudo logrotate -f /etc/logrotate.d/perintahx
```

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop perintahx
sudo systemctl disable perintahx

# Remove service file
sudo rm /etc/systemd/system/perintahx.service
sudo systemctl daemon-reload

# Remove installation
sudo rm -rf /opt/perintahx

# Remove logrotate config
sudo rm /etc/logrotate.d/perintahx
```

## Support

For issues not covered here, check:
1. Audit log: `sudo tail /opt/perintahx/audit.log.jsonl | jq`
2. System logs: `sudo journalctl -u perintahx -n 100`
3. README.md troubleshooting section
