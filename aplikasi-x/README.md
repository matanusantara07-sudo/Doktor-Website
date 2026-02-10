# APLIKASI.X - Editorial Management System

**Version:** 1.0.0  
**Status:** Production-Ready (OBSERVE_ONLY Mode)  
**Compliance:** UU Pers Indonesia, UU ITE, UU Perlindungan Anak

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Usage](#usage)
7. [API Documentation](#api-documentation)
8. [Security](#security)
9. [Compliance](#compliance)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

APLIKASI.X is a comprehensive editorial management system designed for digital newsrooms. It provides a complete workflow from content creation to publication, with strict editorial controls and legal compliance built-in.

### Key Principles

- **Backend Separated from WordPress**: Independent application communicating via REST API
- **Human-Only Editorial Decisions**: AI assists but never decides to publish
- **Complete Audit Trail**: All actions logged immutably
- **OBSERVE_ONLY Default**: Safe mode prevents unintended changes
- **Legal Compliance**: Built-in support for Indonesian press law requirements

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     APLIKASI.X ECOSYSTEM                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Frontend   │◄────────┤  API Gateway │                 │
│  │  Dashboard   │         │  (Express)   │                 │
│  │  (React)     │         └──────┬───────┘                 │
│  └──────────────┘                │                          │
│                                   │                          │
│  ┌────────────────────────────────▼──────────────────────┐  │
│  │           Backend Application Layer                   │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │  │
│  │  │ Content  │  │ Workflow │  │  Auth    │           │  │
│  │  │ Manager  │  │  Engine  │  │ Service  │           │  │
│  │  └──────────┘  └──────────┘  └──────────┘           │  │
│  └───────────┬──────────────────────────────────────────┘  │
│              │                                              │
│  ┌───────────▼──────────────────────────────────────────┐  │
│  │         PostgreSQL Database + Redis Cache           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Integration Layer                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│  │  │WordPress │  │  Social  │  │  Google  │          │  │
│  │  │REST API  │  │  Media   │  │Analytics │          │  │
│  │  └──────────┘  └──────────┘  └──────────┘          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**
- Node.js 18+ with Express.js
- PostgreSQL 14+ (primary database)
- Redis 7+ (caching)
- Sequelize ORM
- JWT authentication

**Frontend:**
- React 18+ with TypeScript
- Tailwind CSS
- React Query for data fetching
- React Router for navigation

**Integrations:**
- WordPress REST API
- Google Analytics API (read-only)
- Google Search Console API (read-only)
- Social Media APIs (Facebook, Twitter, LinkedIn)

---

## ✨ Features

### Editorial Workflow

- **Multi-Stage Approval Process**
  - Draft → In Review → Approved → Ready to Publish → Published
  - Role-based permissions (Reporter, Editor, Chief Editor, Admin)
  - Version control and change tracking
  - Inline comments and feedback

### Content Management

- **Rich Text Editor** with media support
- **SEO Optimization** tools (meta tags, keywords, descriptions)
- **Category & Tag Management** synced with WordPress
- **Media Library** with WordPress integration
- **Scheduled Publishing** for future dates

### WordPress Integration

- **Secure REST API Communication** using Application Passwords
- **Bidirectional Sync** (categories, tags, media)
- **Pre-Publish Validation** (health checks, required fields)
- **Post-Publish Verification** (confirm live status)
- **Dry-Run Mode** for testing without publishing

### Legal Compliance

- **Hak Jawab (Right of Reply)** workflow
- **Koreksi/Ralat (Corrections)** tracking
- **Source Attribution** management
- **Content Moderation** (keyword flagging)
- **Editorial Guidelines** enforcement

### Analytics & Monitoring

- **Google Analytics Integration** (read-only)
- **Search Console Monitoring** (indexing status, search performance)
- **Content Performance Metrics** (views, engagement)
- **Team Productivity Dashboard**

### Security Features

- **JWT-Based Authentication** with refresh tokens
- **Role-Based Access Control (RBAC)**
- **Rate Limiting** (per IP and per user)
- **Audit Trail** (immutable JSONL logs)
- **Input Validation** and sanitization
- **CORS Protection**
- **Helmet.js Security Headers**

---

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 14+
- Redis 7+ (optional but recommended)
- WordPress site with REST API enabled

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd aplikasi-x
```

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Step 3: Database Setup

```bash
# Create PostgreSQL database
createdb aplikasi_x

# Run schema migration
psql -U postgres -d aplikasi_x -f ../database/schema.sql

# Verify tables created
psql -U postgres -d aplikasi_x -c "\dt"
```

### Step 4: Start Backend

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Backend will start on `http://localhost:3000` (or configured PORT).

### Step 5: Frontend Setup (Optional)

```bash
cd ../frontend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env
nano .env

# Start development server
npm start
```

Frontend will start on `http://localhost:3001`.

---

## ⚙️ Configuration

### Environment Variables

Edit `backend/.env`:

```bash
# System Mode (CRITICAL)
SYSTEM_MODE=OBSERVE_ONLY
# Options: OBSERVE_ONLY | SEMI_AUTOMATION | FULL_AUTOMATION

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aplikasi_x
DB_USER=aplikasi_x_user
DB_PASSWORD=your_secure_password

# JWT
JWT_SECRET=your_jwt_secret_minimum_32_characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# WordPress
WP_SITE_URL=https://your-wordpress-site.com
WP_API_URL=https://your-wordpress-site.com/wp-json/wp/v2
WP_USERNAME=api_user
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx

# Publishing
AUTO_PUBLISH_ENABLED=false
MAX_PUBLISH_PER_HOUR=5
```

### WordPress Application Password

1. Login to WordPress Admin
2. Go to **Users → Profile**
3. Scroll to **Application Passwords**
4. Enter name: "APLIKASI.X"
5. Click **Add New Application Password**
6. Copy the generated password (format: `xxxx xxxx xxxx xxxx xxxx xxxx`)
7. Paste into `.env` as `WP_APP_PASSWORD`

### System Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **OBSERVE_ONLY** | Monitoring only, no WordPress writes | Initial testing, safe observation |
| **SEMI_AUTOMATION** | Manual publish trigger, auto-monitoring | Production (recommended) |
| **FULL_AUTOMATION** | Scheduled auto-publish (NOT RECOMMENDED) | High-trust environments only |

**⚠️ IMPORTANT:** Always start with `OBSERVE_ONLY` mode.

---

## 🚀 Usage

### Creating Your First Article

1. **Login** to dashboard (default: `admin` / `Admin123!`)
2. **Change password** immediately
3. Navigate to **Articles → New Article**
4. Fill in:
   - Title
   - Content (rich text editor)
   - Excerpt
   - SEO metadata
   - Categories & tags
5. Click **Save Draft**

### Editorial Workflow

```
Reporter creates draft
    ↓
Editor reviews and approves
    ↓
Chief Editor final approval
    ↓
Manual publish trigger
    ↓
WordPress REST API publish
    ↓
Verification & audit log
```

### Publishing to WordPress

1. Article must be in **READY_TO_PUBLISH** status
2. User must have **CHIEF_EDITOR** or **ADMIN** role
3. Click **Publish to WordPress** button
4. System performs pre-publish checks:
   - WordPress API accessible?
   - Required fields present?
   - System health OK?
5. If checks pass, publishes via REST API
6. Verifies post created successfully
7. Updates article status to **PUBLISHED**
8. Logs to audit trail

### Viewing Audit Logs

```bash
# View recent audit events
tail -f backend/logs/audit.jsonl | jq

# Filter by action
jq 'select(.action == "PUBLISH_TO_WORDPRESS")' backend/logs/audit.jsonl

# Filter by user
jq 'select(.user_id == "user-uuid-here")' backend/logs/audit.jsonl

# Count actions by type
jq -r '.action' backend/logs/audit.jsonl | sort | uniq -c
```

---

## 📚 API Documentation

### Authentication

#### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "username": "user",
    "email": "user@example.com",
    "role": "EDITOR"
  }
}
```

### Articles

#### GET /api/articles
List articles with pagination and filters.

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `status` (DRAFT, IN_REVIEW, APPROVED, etc.)
- `author_id` (filter by author)
- `search` (search in title/content)

**Response:**
```json
{
  "articles": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### POST /api/articles
Create new article (draft).

**Request:**
```json
{
  "title": "Article Title",
  "content": "<p>Article content...</p>",
  "excerpt": "Brief summary",
  "seo_title": "SEO Title",
  "seo_description": "SEO description",
  "category_ids": ["uuid1", "uuid2"],
  "tag_ids": ["uuid3", "uuid4"]
}
```

#### POST /api/articles/:id/publish
Publish article to WordPress (requires CHIEF_EDITOR role).

**Response:**
```json
{
  "success": true,
  "wordpress_post_id": 123,
  "permalink": "https://site.com/article-slug",
  "published_at": "2026-02-10T12:00:00Z"
}
```

### System

#### GET /api/system/health
System health check.

**Response:**
```json
{
  "status": "OK",
  "mode": "OBSERVE_ONLY",
  "database": "connected",
  "wordpress": "accessible",
  "timestamp": "2026-02-10T12:00:00Z"
}
```

---

## 🔒 Security

### Authentication Flow

1. User submits email/password
2. Server validates credentials (bcrypt)
3. Server generates JWT access token (15min expiry)
4. Server generates refresh token (7 days expiry)
5. Access token sent in response body
6. Refresh token sent as httpOnly cookie
7. Client stores access token in memory (NOT localStorage)
8. Client includes access token in Authorization header
9. When access token expires, use refresh token to get new one

### Authorization (RBAC)

| Role | Permissions |
|------|-------------|
| **REPORTER** | Create drafts, edit own articles, submit for review |
| **EDITOR** | All reporter permissions + approve articles, edit any article |
| **CHIEF_EDITOR** | All editor permissions + final approval, publish to WordPress |
| **ADMIN** | All permissions + user management, system settings |

### Rate Limiting

- **Global:** 100 requests per minute per IP
- **Login:** 5 attempts per 15 minutes per IP
- **Publishing:** 20 publishes per hour per user

### Audit Trail

All actions logged to `logs/audit.jsonl`:

```json
{
  "timestamp": "2026-02-10T12:00:00Z",
  "action": "PUBLISH_TO_WORDPRESS",
  "resource_type": "ARTICLE",
  "resource_id": "article-uuid",
  "user_id": "user-uuid",
  "details": {
    "wordpress_post_id": 123,
    "status": "success"
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0..."
}
```

**Audit log is immutable** - cannot be modified or deleted via application.

---

## ⚖️ Compliance

### UU Pers Indonesia

- **Hak Jawab (Right of Reply):** Built-in workflow for handling right of reply requests
- **Koreksi/Ralat (Corrections):** Transparent correction tracking with timestamps
- **Source Attribution:** Mandatory source tracking for quotes, images, data

### UU ITE

- **Data Protection:** User data encrypted, secure storage
- **Audit Trail:** Complete logging of all system actions
- **Access Control:** Role-based permissions, authentication required

### UU Perlindungan Anak

- **Content Moderation:** Keyword flagging for sensitive content
- **Manual Review:** Mandatory review for articles about children
- **Legal Review Trigger:** Automatic flagging for legal team review

### Editorial Guidelines

System enforces checklist before final approval:

- [ ] Sources verified
- [ ] Quotes attributed
- [ ] Images licensed
- [ ] Facts checked
- [ ] Legal review (if sensitive content)
- [ ] SEO metadata complete

---

## 🐛 Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U postgres -d aplikasi_x -c "SELECT 1"

# Check .env configuration
grep DB_ backend/.env
```

### WordPress API Not Accessible

```bash
# Test WordPress REST API
curl -I https://your-site.com/wp-json/

# Should return HTTP 200

# Test authentication
curl -u "username:app_password" https://your-site.com/wp-json/wp/v2/posts
```

### Publishing Fails

1. Check system mode is not `OBSERVE_ONLY`
2. Verify WordPress credentials in `.env`
3. Check article status is `READY_TO_PUBLISH`
4. Verify user has `CHIEF_EDITOR` or `ADMIN` role
5. Check audit log for error details:

```bash
jq 'select(.action == "PUBLISH_TO_WORDPRESS" and .details.status == "failed")' logs/audit.jsonl
```

### Audit Log Not Writing

```bash
# Check AUDIT_LOG_ENABLED in .env
grep AUDIT_LOG_ENABLED backend/.env

# Check logs directory permissions
ls -la backend/logs/

# Should be writable by application user
chmod 755 backend/logs/
```

---

## 📖 Additional Documentation

- [Complete System Plan](../COMPLETE_SYSTEM_PLAN.md) - Detailed architecture
- [APLIKASI.X Architecture](../APLIKASI_X_ARCHITECTURE.md) - System design
- [API Reference](./docs/API.md) - Complete API documentation
- [Deployment Guide](./docs/DEPLOYMENT.md) - Production deployment
- [Security Guide](./docs/SECURITY.md) - Security best practices

---

## 🤝 Support

For issues or questions:

1. Check audit logs: `tail -f logs/audit.jsonl | jq`
2. Check application logs: `tail -f logs/aplikasi-x.log`
3. Verify configuration: `node -e "require('dotenv').config(); console.log(process.env)"`
4. Test WordPress connectivity: `curl -I $WP_SITE_URL/wp-json/`

---

## 📄 License

MIT License - See LICENSE file for details.

---

## ⚠️ Important Notes

1. **Always start in OBSERVE_ONLY mode** for initial testing
2. **Change default admin password** immediately after first login
3. **Use WordPress Application Passwords**, not admin password
4. **Review audit logs regularly** for security monitoring
5. **Test publishing in staging** before production use
6. **Backup database regularly** (automated backups recommended)
7. **Keep dependencies updated** for security patches

---

**Built with ❤️ for digital newsrooms**  
**Compliance-first • Security-focused • Human-controlled**
