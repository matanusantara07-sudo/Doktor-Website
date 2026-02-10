# APLIKASI.X - Deployment Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-10

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Production Environment Setup](#production-environment-setup)
3. [Database Migration](#database-migration)
4. [Application Deployment](#application-deployment)
5. [WordPress Configuration](#wordpress-configuration)
6. [Security Hardening](#security-hardening)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Rollback Procedures](#rollback-procedures)

---

## ✅ Pre-Deployment Checklist

### Infrastructure Requirements

- [ ] **Server:** Ubuntu 22.04 LTS or Amazon Linux 2023
- [ ] **CPU:** Minimum 2 cores (4 cores recommended)
- [ ] **RAM:** Minimum 4GB (8GB recommended)
- [ ] **Disk:** Minimum 20GB SSD
- [ ] **Network:** Static IP address, firewall configured
- [ ] **Domain:** DNS configured, SSL certificate ready

### Software Requirements

- [ ] **Node.js:** 18.x or 20.x LTS
- [ ] **PostgreSQL:** 14.x or 15.x
- [ ] **Redis:** 7.x (optional but recommended)
- [ ] **Nginx:** Latest stable (reverse proxy)
- [ ] **PM2:** Process manager for Node.js
- [ ] **Certbot:** For SSL certificates (Let's Encrypt)

### WordPress Requirements

- [ ] **WordPress:** 6.0+ with REST API enabled
- [ ] **Plugins:** Application Passwords enabled
- [ ] **Permalink Structure:** Post name (not default)
- [ ] **HTTPS:** SSL certificate installed
- [ ] **API Access:** Test `/wp-json/` endpoint accessible

### Credentials Prepared

- [ ] Database credentials (PostgreSQL)
- [ ] WordPress Application Password
- [ ] JWT secret key (minimum 32 characters)
- [ ] Session secret key
- [ ] SMTP credentials (for email alerts)
- [ ] Google Analytics service account (optional)
- [ ] Google Search Console service account (optional)

---

## 🖥️ Production Environment Setup

### Step 1: Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git build-essential

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### Step 2: PostgreSQL Installation

```bash
# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE aplikasi_x;
CREATE USER aplikasi_x_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE aplikasi_x TO aplikasi_x_user;
ALTER DATABASE aplikasi_x OWNER TO aplikasi_x_user;
\q
EOF

# Test connection
psql -U aplikasi_x_user -d aplikasi_x -h localhost -c "SELECT 1"
```

### Step 3: Redis Installation (Optional)

```bash
# Install Redis
sudo apt install -y redis-server

# Configure Redis for production
sudo nano /etc/redis/redis.conf
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Test Redis
redis-cli ping  # Should return PONG
```

### Step 4: Nginx Installation

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Test Nginx
curl http://localhost  # Should return Nginx welcome page
```

### Step 5: PM2 Installation

```bash
# Install PM2 globally
sudo npm install -g pm2

# Configure PM2 to start on boot
pm2 startup systemd
# Follow the command output instructions

# Verify PM2
pm2 list  # Should show empty list initially
```

---

## 💾 Database Migration

### Step 1: Upload Schema

```bash
# Copy schema.sql to server
scp database/schema.sql user@server:/tmp/

# SSH to server
ssh user@server

# Run migration
psql -U aplikasi_x_user -d aplikasi_x -h localhost -f /tmp/schema.sql

# Verify tables created
psql -U aplikasi_x_user -d aplikasi_x -h localhost -c "\dt"
```

### Step 2: Verify Database

```bash
# Check users table
psql -U aplikasi_x_user -d aplikasi_x -h localhost -c "SELECT username, role FROM users;"

# Should show default admin user

# Check system settings
psql -U aplikasi_x_user -d aplikasi_x -h localhost -c "SELECT key, value FROM system_settings;"
```

### Step 3: Database Backup Setup

```bash
# Create backup script
sudo nano /usr/local/bin/backup-aplikasi-x.sh
```

```bash
#!/bin/bash
# APLIKASI.X Database Backup Script

BACKUP_DIR="/var/backups/aplikasi-x"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="aplikasi_x"
DB_USER="aplikasi_x_user"

mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U $DB_USER -h localhost $DB_NAME | gzip > $BACKUP_DIR/aplikasi_x_$DATE.sql.gz

# Keep only last 30 days of backups
find $BACKUP_DIR -name "aplikasi_x_*.sql.gz" -mtime +30 -delete

echo "Backup completed: aplikasi_x_$DATE.sql.gz"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/backup-aplikasi-x.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-aplikasi-x.sh
```

---

## 🚀 Application Deployment

### Step 1: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/aplikasi-x
sudo chown $USER:$USER /opt/aplikasi-x

# Clone repository
cd /opt/aplikasi-x
git clone <repository-url> .

# Or upload files via SCP
scp -r aplikasi-x/* user@server:/opt/aplikasi-x/
```

### Step 2: Backend Setup

```bash
cd /opt/aplikasi-x/backend

# Install dependencies
npm install --production

# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Production .env Configuration:**

```bash
NODE_ENV=production
PORT=3000
API_PREFIX=/api

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aplikasi_x
DB_USER=aplikasi_x_user
DB_PASSWORD=your_secure_password_here

# JWT (Generate secure keys)
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# WordPress
WP_SITE_URL=https://your-wordpress-site.com
WP_API_URL=https://your-wordpress-site.com/wp-json/wp/v2
WP_USERNAME=api_user
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx

# System Mode
SYSTEM_MODE=OBSERVE_ONLY

# Publishing
AUTO_PUBLISH_ENABLED=false
MAX_PUBLISH_PER_HOUR=5

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://your-domain.com

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/aplikasi-x/aplikasi-x.log

# Audit
AUDIT_LOG_ENABLED=true
AUDIT_LOG_PATH=/var/log/aplikasi-x/audit.jsonl
```

### Step 3: Create Log Directories

```bash
# Create log directory
sudo mkdir -p /var/log/aplikasi-x
sudo chown $USER:$USER /var/log/aplikasi-x

# Create logs directory in application
mkdir -p /opt/aplikasi-x/backend/logs
```

### Step 4: Start Application with PM2

```bash
cd /opt/aplikasi-x/backend

# Start application
pm2 start src/server.js --name aplikasi-x-backend

# Save PM2 configuration
pm2 save

# View logs
pm2 logs aplikasi-x-backend

# Check status
pm2 status
```

### Step 5: Configure Nginx Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/aplikasi-x
```

```nginx
# APLIKASI.X Nginx Configuration

upstream aplikasi_x_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Logging
    access_log /var/log/nginx/aplikasi-x-access.log;
    error_log /var/log/nginx/aplikasi-x-error.log;
    
    # API Proxy
    location /api {
        proxy_pass http://aplikasi_x_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health Check
    location /health {
        proxy_pass http://aplikasi_x_backend;
        access_log off;
    }
    
    # Frontend (if serving static files)
    location / {
        root /opt/aplikasi-x/frontend/build;
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/aplikasi-x /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 6: SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Auto-renewal is configured via cron automatically
```

---

## 🔧 WordPress Configuration

### Step 1: Enable REST API

1. Login to WordPress Admin
2. Go to **Settings → Permalinks**
3. Select **Post name** (not "Plain")
4. Click **Save Changes**

### Step 2: Create Application Password

1. Go to **Users → Profile**
2. Scroll to **Application Passwords**
3. Enter name: "APLIKASI.X Production"
4. Click **Add New Application Password**
5. Copy the generated password
6. Add to `/opt/aplikasi-x/backend/.env`:

```bash
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

### Step 3: Test WordPress API

```bash
# Test unauthenticated endpoint
curl -I https://your-wordpress-site.com/wp-json/

# Should return HTTP 200

# Test authenticated endpoint
curl -u "api_user:xxxx xxxx xxxx xxxx xxxx xxxx" \
  https://your-wordpress-site.com/wp-json/wp/v2/posts

# Should return JSON array of posts
```

### Step 4: WordPress Security (Optional)

Add to WordPress `wp-config.php`:

```php
// Restrict REST API to authenticated users only
add_filter('rest_authentication_errors', function($result) {
    if (!is_user_logged_in()) {
        return new WP_Error(
            'rest_not_logged_in',
            'You are not currently logged in.',
            array('status' => 401)
        );
    }
    return $result;
});
```

---

## 🔒 Security Hardening

### Step 1: Firewall Configuration

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 2: Fail2Ban (Brute Force Protection)

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Create custom jail for APLIKASI.X
sudo nano /etc/fail2ban/jail.d/aplikasi-x.conf
```

```ini
[aplikasi-x-auth]
enabled = true
port = http,https
filter = aplikasi-x-auth
logpath = /var/log/aplikasi-x/aplikasi-x.log
maxretry = 5
bantime = 3600
findtime = 600
```

```bash
# Create filter
sudo nano /etc/fail2ban/filter.d/aplikasi-x-auth.conf
```

```ini
[Definition]
failregex = ^.*"action":"LOGIN_FAILED".*"ip_address":"<HOST>".*$
ignoreregex =
```

```bash
# Restart Fail2Ban
sudo systemctl restart fail2ban

# Check status
sudo fail2ban-client status aplikasi-x-auth
```

### Step 3: Secure Environment Variables

```bash
# Restrict .env file permissions
chmod 600 /opt/aplikasi-x/backend/.env

# Ensure owned by application user
chown $USER:$USER /opt/aplikasi-x/backend/.env
```

### Step 4: Database Security

```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Ensure only localhost connections allowed
# host    aplikasi_x    aplikasi_x_user    127.0.0.1/32    md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

---

## 📊 Monitoring & Maintenance

### Step 1: Application Monitoring

```bash
# View PM2 status
pm2 status

# View logs
pm2 logs aplikasi-x-backend --lines 100

# Monitor resources
pm2 monit

# Restart application
pm2 restart aplikasi-x-backend

# Reload without downtime
pm2 reload aplikasi-x-backend
```

### Step 2: Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/aplikasi-x
```

```
/var/log/aplikasi-x/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 aplikasi-x aplikasi-x
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Step 3: Health Monitoring

```bash
# Create health check script
nano /usr/local/bin/check-aplikasi-x-health.sh
```

```bash
#!/bin/bash
# APLIKASI.X Health Check Script

HEALTH_URL="https://your-domain.com/health"
ALERT_EMAIL="admin@your-domain.com"

response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $response -ne 200 ]; then
    echo "APLIKASI.X health check failed: HTTP $response" | \
        mail -s "APLIKASI.X Alert: Health Check Failed" $ALERT_EMAIL
    
    # Attempt restart
    pm2 restart aplikasi-x-backend
fi
```

```bash
# Make executable
chmod +x /usr/local/bin/check-aplikasi-x-health.sh

# Add to crontab (every 5 minutes)
crontab -e
# Add: */5 * * * * /usr/local/bin/check-aplikasi-x-health.sh
```

### Step 4: Audit Log Monitoring

```bash
# View recent audit events
tail -f /var/log/aplikasi-x/audit.jsonl | jq

# Count actions by type
jq -r '.action' /var/log/aplikasi-x/audit.jsonl | sort | uniq -c | sort -rn

# Find failed login attempts
jq 'select(.action == "LOGIN_FAILED")' /var/log/aplikasi-x/audit.jsonl

# Monitor publishing activity
jq 'select(.action == "PUBLISH_TO_WORDPRESS")' /var/log/aplikasi-x/audit.jsonl
```

---

## 🔄 Rollback Procedures

### Database Rollback

```bash
# List available backups
ls -lh /var/backups/aplikasi-x/

# Restore from backup
gunzip < /var/backups/aplikasi-x/aplikasi_x_20260210_020000.sql.gz | \
    psql -U aplikasi_x_user -d aplikasi_x -h localhost
```

### Application Rollback

```bash
# Stop application
pm2 stop aplikasi-x-backend

# Checkout previous version
cd /opt/aplikasi-x
git checkout <previous-commit-hash>

# Reinstall dependencies
cd backend
npm install --production

# Restart application
pm2 restart aplikasi-x-backend

# Verify
pm2 logs aplikasi-x-backend
```

---

## ✅ Post-Deployment Verification

### Checklist

- [ ] Application accessible via HTTPS
- [ ] Health endpoint returns 200: `curl https://your-domain.com/health`
- [ ] Login works with default admin credentials
- [ ] Database connection successful
- [ ] WordPress API accessible
- [ ] Audit logs writing to `/var/log/aplikasi-x/audit.jsonl`
- [ ] PM2 shows application running
- [ ] Nginx logs show no errors
- [ ] SSL certificate valid
- [ ] Firewall rules active
- [ ] Backups configured and tested
- [ ] Monitoring scripts active

### Final Steps

1. **Change default admin password**
2. **Create additional user accounts**
3. **Test complete workflow** (create article → approve → publish)
4. **Verify WordPress integration** (check published post)
5. **Review audit logs** for any errors
6. **Document custom configurations**
7. **Train editorial team** on system usage

---

## 📞 Support

For deployment issues:

1. Check application logs: `pm2 logs aplikasi-x-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/aplikasi-x-error.log`
3. Check audit logs: `tail -f /var/log/aplikasi-x/audit.jsonl | jq`
4. Test database: `psql -U aplikasi_x_user -d aplikasi_x -h localhost -c "SELECT 1"`
5. Test WordPress API: `curl -I https://your-wordpress-site.com/wp-json/`

---

**Deployment completed successfully! 🎉**
