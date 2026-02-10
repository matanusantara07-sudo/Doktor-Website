# APLIKASI.X - Arsitektur Sistem Aplikasi Web Redaksi Digital

**Tanggal:** 2026-02-10
**Versi:** v1.0
**Mode:** OBSERVE_ONLY
**Status:** PERENCANAAN ARSITEKTUR

---

## RINGKASAN EKSEKUTIF

APLIKASI.X adalah sistem aplikasi web terpisah yang dirancang untuk mendukung operasional redaksi media digital dengan prinsip:

1. **Backend terpisah** dari WordPress (komunikasi via REST API)
2. **Keputusan editorial HANYA oleh manusia** (AI tidak boleh mengambil keputusan publish)
3. **Audit trail lengkap** untuk semua aktivitas
4. **Mode OBSERVE_ONLY** sebagai default (zero-execution)
5. **Integrasi Google bersifat READ-ONLY**
6. **Kepatuhan hukum pers dan perlindungan anak**

---

## 1. DIAGRAM ARSITEKTUR SISTEM

### 1.1 Arsitektur Tingkat Tinggi

```
┌─────────────────────────────────────────────────────────────────┐
│                        APLIKASI.X ECOSYSTEM                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐             │
│  │   FRONTEND       │◄────────┤   API GATEWAY    │             │
│  │   Dashboard      │         │   (Auth Layer)   │             │
│  │   (React/Vue)    │         └────────┬─────────┘             │
│  └──────────────────┘                  │                        │
│                                        │                        │
│  ┌─────────────────────────────────────▼───────────────────┐   │
│  │              BACKEND APPLICATION LAYER                   │   │
│  │          (Node.js/Python/Go - API Server)                │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │
│  │  │ Content  │  │ Workflow │  │ User/    │  │ Monitor  │ │   │
│  │  │ Manager  │  │ Engine   │  │ Auth     │  │ Service  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │   │
│  └───────────┬──────────────────────────────────────────────┘   │
│              │                                                   │
│  ┌───────────▼──────────────────────────────────────────────┐   │
│  │              DATABASE LAYER                              │   │
│  │  ┌──────────────┐    ┌──────────────┐                   │   │
│  │  │  PostgreSQL  │    │    Redis     │                   │   │
│  │  │  (Primary)   │    │   (Cache)    │                   │   │
│  │  └──────────────┘    └──────────────┘                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           INTEGRATION LAYER (External Systems)           │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │
│  │  │WordPress │  │  Social  │  │  Google  │  │ Observer │ │   │
│  │  │REST API  │  │  Media   │  │Analytics │  │  System  │ │   │
│  │  │(READ +   │  │  APIs    │  │  APIs    │  │(PerintahX│ │   │
│  │  │ WRITE)   │  │(Webhooks)│  │(READ-ONLY│  │ Monitor) │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              AUDIT & LOGGING LAYER                       │   │
│  │  - Semua aktivitas tercatat (JSONL/Database)             │   │
│  │  - Immutable audit trail                                 │   │
│  │  - Legal compliance logging                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Alur Data Redaksi

```
┌─────────────────────────────────────────────────────────────────┐
│                     EDITORIAL WORKFLOW                           │
└─────────────────────────────────────────────────────────────────┘

[REPORTER]
    │
    ├─► CREATE_DRAFT ──► [APLIKASI.X Database]
    │                         │
    │                         ├─► Status: "DRAFT"
    │                         ├─► Metadata: Author, timestamp, category
    │                         └─► Auto-save: Every 30s
    │
    ▼
[REDAKTUR]
    │
    ├─► REVIEW_DRAFT ──► Edit content, add notes
    │                         │
    │                         ├─► Status: "IN_REVIEW"
    │                         ├─► Track changes: Version control
    │                         └─► Feedback: Inline comments
    │
    ├─► APPROVE_OR_REJECT
    │       │
    │       ├─► REJECT ──► Status: "REVISION_NEEDED" ──► Back to Reporter
    │       │
    │       └─► APPROVE ──► Status: "APPROVED_BY_EDITOR"
    │
    ▼
[PEMIMPIN REDAKSI]
    │
    ├─► FINAL_REVIEW ──► Legal check, fact-check, tone review
    │                         │
    │                         ├─► Status: "FINAL_REVIEW"
    │                         └─► Optional: External fact-check API
    │
    ├─► APPROVE_TO_PUBLISH
    │       │
    │       ├─► Manual approval required (NO AUTO-PUBLISH by AI)
    │       │
    │       └─► Status: "READY_TO_PUBLISH"
    │
    ▼
[SISTEM - HUMAN TRIGGERED ONLY]
    │
    ├─► PUBLISH_TO_WORDPRESS
    │       │
    │       ├─► Pre-publish checks:
    │       │     - Server health OK?
    │       │     - WordPress API accessible?
    │       │     - Required fields present?
    │       │
    │       ├─► POST to WordPress REST API
    │       │     - Endpoint: /wp-json/wp/v2/posts
    │       │     - Auth: Application Password
    │       │     - Status: "publish" or "draft" (configurable)
    │       │
    │       ├─► Verify publication
    │       │     - Check post ID returned
    │       │     - Verify post live on site
    │       │
    │       └─► Status: "PUBLISHED" ──► [Audit Log]
    │
    ▼
[SISTEM - DISTRIBUTION]
    │
    ├─► SOCIAL_MEDIA_DISPATCH (Optional, Manual Trigger)
    │       │
    │       ├─► Twitter/X API
    │       ├─► Facebook Graph API
    │       ├─► Instagram Graph API
    │       └─► LinkedIn API
    │
    └─► GOOGLE_INDEXING (Automatic, Read-Only Monitoring)
            │
            ├─► Ping Google Search Console
            ├─► Submit sitemap
            └─► Monitor indexing status (READ-ONLY)
```

---

## 2. PENJELASAN MODUL SISTEM

### 2.1 Frontend Dashboard

**Teknologi:** React/Vue.js/Svelte (modern SPA framework)

**Komponen:**
- **Content Editor**
  - WYSIWYG editor (TinyMCE/Quill/ProseMirror)
  - Markdown support (optional)
  - Media upload (images, videos)
  - SEO metadata editor (title, description, keywords)
  - Category/tag assignment

- **Workflow Manager**
  - Kanban board view (Draft → Review → Approved → Published)
  - Assignment system (assign articles to editors)
  - Comment/feedback threads
  - Version history viewer

- **Dashboard Analytics**
  - Content performance (views, engagement)
  - Publishing calendar
  - Team productivity metrics
  - System health status

- **User Management**
  - Role-based access control (RBAC)
  - Activity logs
  - Permission management

### 2.2 Backend Application Layer

**Teknologi:** Node.js (Express/NestJS) ATAU Python (FastAPI/Django) ATAU Go (Gin/Echo)

**Modul:**

#### A. Content Manager
- **Fungsi:**
  - CRUD operations untuk artikel
  - Media management (upload, organize)
  - Metadata management
  - Version control (track changes)
  - Search & filter

- **Database Schema (Simplified):**
```sql
-- Articles Table
CREATE TABLE articles (
  id UUID PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL, -- DRAFT, IN_REVIEW, APPROVED, PUBLISHED
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  wordpress_post_id INT, -- NULL until published to WP
  metadata JSONB -- SEO fields, custom fields
);

-- Workflow History Table
CREATE TABLE workflow_history (
  id UUID PRIMARY KEY,
  article_id UUID REFERENCES articles(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- CREATE, EDIT, SUBMIT, APPROVE, REJECT, PUBLISH
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  comment TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- REPORTER, EDITOR, CHIEF_EDITOR, ADMIN
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log Table (Immutable)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50), -- ARTICLE, USER, SYSTEM
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

#### B. Workflow Engine
- **Fungsi:**
  - State machine untuk article status
  - Role-based permissions (who can do what)
  - Automatic notifications (email/Slack when status changes)
  - SLA tracking (time spent in each stage)

- **State Transitions:**
```
DRAFT ──────► IN_REVIEW ──────► APPROVED ──────► READY_TO_PUBLISH ──────► PUBLISHED
  ▲                │                 │                                        │
  │                ▼                 ▼                                        ▼
  └──────── REVISION_NEEDED    REJECTED                                  ARCHIVED
```

- **Permission Matrix:**
```
Action               │ Reporter │ Editor │ Chief Editor │ Admin
─────────────────────┼──────────┼────────┼──────────────┼───────
Create Draft         │    ✓     │   ✓    │      ✓       │   ✓
Edit Own Draft       │    ✓     │   ✓    │      ✓       │   ✓
Edit Any Draft       │    ✗     │   ✓    │      ✓       │   ✓
Submit for Review    │    ✓     │   ✓    │      ✓       │   ✓
Approve Article      │    ✗     │   ✓    │      ✓       │   ✓
Final Approval       │    ✗     │   ✗    │      ✓       │   ✓
Publish to WordPress │    ✗     │   ✗    │      ✓       │   ✓
Manage Users         │    ✗     │   ✗    │      ✗       │   ✓
View Analytics       │    ✓     │   ✓    │      ✓       │   ✓
```

#### C. User/Auth Service
- **Fungsi:**
  - JWT-based authentication
  - Role-based access control (RBAC)
  - Session management
  - Password reset flow
  - Two-factor authentication (optional)

#### D. Monitor Service
- **Fungsi:**
  - Server health monitoring (CPU, memory, disk)
  - WordPress connectivity checks
  - Database performance metrics
  - API rate limit tracking
  - Alert notifications (Slack/email)

### 2.3 Integration Layer

#### A. WordPress REST API Integration

**Mode:** READ + WRITE (controlled)

**Endpoints Used:**
```
GET  /wp-json/wp/v2/posts          - Verify published posts
POST /wp-json/wp/v2/posts          - Create new post
PUT  /wp-json/wp/v2/posts/{id}     - Update existing post
GET  /wp-json/wp/v2/categories     - Fetch categories
GET  /wp-json/wp/v2/media          - Fetch media library
POST /wp-json/wp/v2/media          - Upload media
```

**Authentication:**
- WordPress Application Password (recommended)
- Basic Auth: `username:application_password`
- Header: `Authorization: Basic base64(username:app_password)`

**Safety Mechanisms:**
- Rate limiting (max 10 requests/minute)
- Retry logic with exponential backoff
- Idempotency checks (prevent duplicate posts)
- Dry-run mode (validate without publishing)

**Implementation Example (Node.js):**
```javascript
// wordpress-client.js
const axios = require('axios');

class WordPressClient {
  constructor(siteUrl, username, appPassword) {
    this.baseUrl = `${siteUrl}/wp-json/wp/v2`;
    this.auth = {
      username: username,
      password: appPassword
    };
  }

  async createPost(article) {
    // Pre-publish validation
    if (!article.title || !article.content) {
      throw new Error('Title and content are required');
    }

    const payload = {
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
      status: 'publish', // or 'draft' in OBSERVE_ONLY mode
      categories: article.categoryIds,
      tags: article.tagIds,
      meta: article.metadata
    };

    try {
      const response = await axios.post(`${this.baseUrl}/posts`, payload, {
        auth: this.auth,
        timeout: 10000 // 10s timeout
      });

      return {
        success: true,
        postId: response.data.id,
        permalink: response.data.link
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async verifyPostPublished(postId) {
    try {
      const response = await axios.get(`${this.baseUrl}/posts/${postId}`, {
        auth: this.auth
      });
      return response.data.status === 'publish';
    } catch (error) {
      return false;
    }
  }
}

module.exports = WordPressClient;
```

#### B. Social Media Dispatcher

**Mode:** WEBHOOK-BASED (Manual Trigger Only)

**Platform Support:**
- Twitter/X API v2
- Facebook Graph API
- Instagram Graph API
- LinkedIn API

**Workflow:**
1. User triggers "Share to Social Media" (manual button)
2. System prepares post content (title + excerpt + link)
3. User reviews and approves preview
4. System dispatches to selected platforms
5. Result logged to audit trail

**Safety:**
- NO automatic posting (human approval required)
- Preview before posting
- Rate limit compliance (platform-specific)
- Error handling with retry

#### C. Google Analytics/Search Console/AdSense

**Mode:** READ-ONLY ONLY

**Google Analytics:**
- Fetch pageviews, sessions, bounce rate
- Top content performance
- Traffic sources
- **NO WRITE ACCESS** (read-only service account)

**Google Search Console:**
- Indexing status
- Search performance (clicks, impressions, CTR)
- Coverage issues
- **NO WRITE ACCESS** (read-only)

**Google AdSense:**
- Revenue metrics
- Ad performance
- **NO WRITE ACCESS** (read-only)

**Authentication:**
- Service Account with JSON key
- Scopes: `analytics.readonly`, `webmasters.readonly`
- No OAuth consent flow (backend service)

#### D. Observer System (PerintahX)

**Integration:**
- APLIKASI.X reads health status from PerintahX audit log
- Dashboard displays server health metrics
- Alerts forwarded to APLIKASI.X notification system
- **NO CONTROL OVER PERINTAHX** (observer only)

---

## 3. ALUR DATA ANTAR KOMPONEN

### 3.1 Publishing Flow (End-to-End)

```
1. Reporter creates draft
   ├─► Frontend: POST /api/articles { title, content, ... }
   ├─► Backend: Validate input, save to database
   ├─► Database: INSERT INTO articles (status='DRAFT')
   └─► Audit Log: Record "CREATE_DRAFT" action

2. Editor reviews and approves
   ├─► Frontend: PUT /api/articles/{id}/approve
   ├─► Backend: Check permissions (is user an editor?)
   ├─► Backend: Update status to "APPROVED"
   ├─► Database: UPDATE articles SET status='APPROVED'
   ├─► Workflow History: Record status change
   ├─► Notification: Email to chief editor
   └─► Audit Log: Record "APPROVE_ARTICLE" action

3. Chief Editor final approval
   ├─► Frontend: PUT /api/articles/{id}/final-approve
   ├─► Backend: Check permissions (is user chief editor?)
   ├─► Backend: Update status to "READY_TO_PUBLISH"
   ├─► Database: UPDATE articles SET status='READY_TO_PUBLISH'
   └─► Audit Log: Record "FINAL_APPROVE" action

4. Human-triggered publish to WordPress
   ├─► Frontend: POST /api/articles/{id}/publish (manual button click)
   ├─► Backend: Verify current status is "READY_TO_PUBLISH"
   ├─► Backend: Check WordPress connectivity (health check)
   ├─► Backend: Call WordPress REST API
   │     └─► WordPress: POST /wp-json/wp/v2/posts
   ├─► WordPress: Return post ID and permalink
   ├─► Backend: Update article.wordpress_post_id
   ├─► Backend: Update status to "PUBLISHED"
   ├─► Database: UPDATE articles SET status='PUBLISHED', wordpress_post_id=123
   ├─► Audit Log: Record "PUBLISH_TO_WORDPRESS" with post_id
   └─► Notification: Success notification to all stakeholders

5. Optional: Social media dispatch
   ├─► Frontend: POST /api/articles/{id}/share-social (manual)
   ├─► Backend: Prepare social media post previews
   ├─► Frontend: User approves previews
   ├─► Backend: Dispatch to selected platforms (Twitter, Facebook, etc.)
   └─► Audit Log: Record "SOCIAL_MEDIA_DISPATCH" with platform results
```

### 3.2 Monitoring Flow

```
1. PerintahX (Observer System)
   ├─► Monitors: Server, WordPress, Database
   ├─► Logs: audit.log.jsonl (JSONL format)
   └─► Alerts: Critical issues detected

2. APLIKASI.X Monitor Service
   ├─► Reads: PerintahX audit.log.jsonl (polling every 60s)
   ├─► Parses: Extract health status
   ├─► Stores: Cache in Redis for dashboard
   └─► Alerts: Forward critical alerts to users

3. Dashboard Display
   ├─► Frontend: GET /api/system/health
   ├─► Backend: Return cached health status from Redis
   └─► Frontend: Display health widgets (green/yellow/red indicators)

4. Google Analytics Integration (Read-Only)
   ├─► Scheduled Job: Fetch analytics every 1 hour
   ├─► Google Analytics API: Query pageviews, sessions
   ├─► Backend: Store metrics in database
   ├─► Dashboard: Display traffic trends, top content
   └─► Audit Log: Record "FETCH_ANALYTICS" action
```

---

## 4. RISIKO TEKNIS & MITIGASI

### 4.1 Risiko Keamanan

| Risiko | Dampak | Probabilitas | Mitigasi |
|--------|--------|--------------|----------|
| **Unauthorized access to WordPress** | Tinggi | Sedang | - Application Password (bukan password admin)<br>- Rotate credentials setiap 90 hari<br>- IP whitelist di WordPress<br>- Rate limiting di API Gateway |
| **SQL Injection** | Tinggi | Rendah | - ORM/Query builder (Sequelize/Prisma/SQLAlchemy)<br>- Parameterized queries only<br>- Input validation & sanitization<br>- Database user dengan least privilege |
| **XSS (Cross-Site Scripting)** | Sedang | Sedang | - Content Security Policy (CSP)<br>- Output encoding di frontend<br>- Sanitize HTML di backend<br>- Use DOMPurify untuk rich text |
| **CSRF (Cross-Site Request Forgery)** | Sedang | Sedang | - CSRF tokens di semua form<br>- SameSite cookies<br>- Verify Origin/Referer headers |
| **Credential leakage** | Tinggi | Rendah | - Environment variables (tidak di git)<br>- Secret management (Vault/AWS Secrets Manager)<br>- Audit log untuk akses credentials<br>- Rotate keys regularly |
| **DDoS Attack** | Sedang | Sedang | - Rate limiting (per IP, per user)<br>- CDN (Cloudflare/AWS CloudFront)<br>- Auto-scaling infrastructure<br>- WAF (Web Application Firewall) |

### 4.2 Risiko Operasional

| Risiko | Dampak | Probabilitas | Mitigasi |
|--------|--------|--------------|----------|
| **WordPress API down** | Tinggi | Sedang | - Health check sebelum publish<br>- Retry logic dengan backoff<br>- Queue system (publish nanti)<br>- Alert ke admin |
| **Database outage** | Tinggi | Rendah | - Database replication (master-slave)<br>- Automated backups (hourly)<br>- Connection pooling<br>- Read replicas untuk analytics |
| **Data loss** | Tinggi | Rendah | - Automated backups (retention 30 hari)<br>- Point-in-time recovery (PITR)<br>- Version control untuk artikel<br>- Soft delete (mark as deleted, tidak hapus data) |
| **Concurrent editing conflict** | Sedang | Sedang | - Optimistic locking (version number)<br>- Real-time collaboration (WebSocket)<br>- Conflict resolution UI<br>- Auto-save drafts |
| **Performance degradation** | Sedang | Sedang | - Caching (Redis untuk frequent queries)<br>- Database indexing<br>- Lazy loading di frontend<br>- Pagination untuk large datasets |
| **Third-party API limits** | Sedang | Tinggi | - Rate limit tracking<br>- Fallback strategies<br>- Cache API responses<br>- Alert before limit reached |

### 4.3 Risiko Legal & Etika

| Risiko | Dampak | Probabilitas | Mitigasi |
|--------|--------|--------------|----------|
| **Publikasi konten ilegal** | Tinggi | Rendah | - Multi-level approval (editor + chief editor)<br>- Fact-checking workflow<br>- Legal review untuk konten sensitif<br>- Audit trail lengkap |
| **Pelanggaran hak cipta** | Tinggi | Sedang | - Media usage tracking<br>- Source attribution mandatory<br>- Integration dengan plagiarism checker<br>- Training untuk reporter |
| **Pelanggaran UU Pers** | Tinggi | Rendah | - Editorial guidelines enforcement<br>- Hak jawab mechanism<br>- Koreksi/ralat workflow<br>- Legal consultant access |
| **Pelanggaran perlindungan anak** | Tinggi | Rendah | - Content moderation (automated + manual)<br>- Image recognition untuk konten sensitif<br>- Reporter training<br>- Compliance dengan UU Perlindungan Anak |
| **GDPR/Privacy violation** | Sedang | Rendah | - Data anonymization<br>- User consent tracking<br>- Right to be forgotten mechanism<br>- Privacy policy enforcement |

---

## 5. REKOMENDASI STACK TEKNOLOGI

### 5.1 Option 1: Node.js Stack (Recommended)

**Alasan:**
- Ekosistem mature untuk web apps
- Full-stack JavaScript (frontend + backend)
- Excellent package ecosystem (npm)
- Good performance untuk I/O-bound operations
- Large community support

**Stack:**
```
Frontend:  React + TypeScript + Vite
Backend:   Node.js + NestJS (atau Express)
Database:  PostgreSQL 14+
Cache:     Redis 7+
ORM:       Prisma (type-safe) atau Sequelize
Auth:      Passport.js + JWT
API Docs:  Swagger/OpenAPI
Testing:   Jest + Supertest
Deploy:    Docker + Kubernetes (atau PM2 untuk simple setup)
```

**Pros:**
- Single language (JavaScript/TypeScript)
- Fast development cycle
- Excellent tooling (VSCode, debugging)
- Easy to find developers

**Cons:**
- CPU-heavy tasks kurang optimal (gunakan worker threads atau microservice)
- Memory leaks jika tidak hati-hati

### 5.2 Option 2: Python Stack

**Alasan:**
- Excellent untuk data processing & AI integration
- Strong integration dengan Google APIs
- Clean syntax, mudah maintenance
- Good untuk prototyping

**Stack:**
```
Frontend:  React + TypeScript + Vite (sama)
Backend:   Python + FastAPI (atau Django REST Framework)
Database:  PostgreSQL 14+
Cache:     Redis 7+
ORM:       SQLAlchemy (FastAPI) atau Django ORM
Auth:      OAuth2/JWT via FastAPI-Users atau Django AllAuth
API Docs:  Automatic via FastAPI (Swagger UI)
Testing:   Pytest
Deploy:    Docker + Gunicorn + Nginx
```

**Pros:**
- Excellent untuk data analytics & AI features (future)
- Strong typing dengan Pydantic (FastAPI)
- Clean code structure
- Great for scientific computing (jika ada analisis data)

**Cons:**
- Slower startup time dibanding Node.js
- GIL (Global Interpreter Lock) untuk multi-threading

### 5.3 Option 3: Go Stack (Advanced)

**Alasan:**
- Excellent performance (compiled language)
- Low memory footprint
- Built-in concurrency (goroutines)
- Strong standard library

**Stack:**
```
Frontend:  React + TypeScript + Vite (sama)
Backend:   Go + Gin (atau Echo/Fiber)
Database:  PostgreSQL 14+
Cache:     Redis 7+
ORM:       GORM
Auth:      golang-jwt
API Docs:  Swaggo (Swagger for Go)
Testing:   Go testing package + Testify
Deploy:    Docker (single binary)
```

**Pros:**
- Fastest performance
- Smallest binary size
- Built-in concurrency
- Easy deployment (single binary)

**Cons:**
- Steeper learning curve
- Smaller ecosystem dibanding Node.js/Python
- Verbose error handling

### 5.4 Rekomendasi Final

**Untuk tim dengan resource terbatas:** **Node.js Stack (Option 1)**
- Alasan: Fastest time-to-market, large talent pool, mature ecosystem

**Untuk tim dengan fokus analytics/AI:** **Python Stack (Option 2)**
- Alasan: Best integration dengan Google APIs, data processing, future AI features

**Untuk sistem dengan traffic tinggi:** **Go Stack (Option 3)**
- Alasan: Best performance, low resource usage, high concurrency

---

## 6. TECHNICAL SPECIFICATIONS

### 6.1 Database Schema (PostgreSQL)

```sql
-- ============================================
-- APLIKASI.X DATABASE SCHEMA v1.0
-- ============================================

-- Users & Authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('REPORTER', 'EDITOR', 'CHIEF_EDITOR', 'ADMIN')),
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Articles
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'DRAFT', 'IN_REVIEW', 'REVISION_NEEDED', 'APPROVED',
    'READY_TO_PUBLISH', 'PUBLISHED', 'ARCHIVED'
  )),
  featured_image_url TEXT,
  seo_title VARCHAR(255),
  seo_description VARCHAR(500),
  seo_keywords TEXT[],
  wordpress_post_id INT,
  wordpress_permalink TEXT,
  scheduled_publish_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_articles_author ON articles(author_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_created ON articles(created_at DESC);
CREATE INDEX idx_articles_published ON articles(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX idx_articles_wp_id ON articles(wordpress_post_id) WHERE wordpress_post_id IS NOT NULL;

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  wordpress_category_id INT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);

-- Article-Category Mapping (Many-to-Many)
CREATE TABLE article_categories (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, category_id)
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  wordpress_tag_id INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Article-Tag Mapping (Many-to-Many)
CREATE TABLE article_tags (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

-- Workflow History (Audit Trail untuk Article State Changes)
CREATE TABLE workflow_history (
  id BIGSERIAL PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(50) NOT NULL, -- CREATE, EDIT, SUBMIT, APPROVE, REJECT, PUBLISH, ARCHIVE
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  comment TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_workflow_article ON workflow_history(article_id, timestamp DESC);
CREATE INDEX idx_workflow_user ON workflow_history(user_id, timestamp DESC);

-- Comments/Feedback (Internal Editor Comments)
CREATE TABLE article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_article ON article_comments(article_id, created_at DESC);

-- Media Library
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  file_path TEXT NOT NULL,
  url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  wordpress_media_id INT,
  alt_text TEXT,
  caption TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_media_uploaded_by ON media(uploaded_by, created_at DESC);

-- Audit Log (Immutable, Complete System Activity Log)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50), -- ARTICLE, USER, SYSTEM, INTEGRATION
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_log(action, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id, timestamp DESC);

-- System Settings (Key-Value Store)
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Publishing Queue (Optional: for scheduled publishing)
CREATE TABLE publishing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')),
  retry_count INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX idx_queue_scheduled ON publishing_queue(scheduled_at, status);

-- Analytics Cache (Cache untuk Google Analytics data)
CREATE TABLE analytics_cache (
  id BIGSERIAL PRIMARY KEY,
  metric_type VARCHAR(100) NOT NULL, -- PAGEVIEWS, SESSIONS, BOUNCE_RATE
  date DATE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_type, date)
);

CREATE INDEX idx_analytics_date ON analytics_cache(metric_type, date DESC);
```

### 6.2 API Endpoints Specification

#### Authentication Endpoints
```
POST   /api/auth/login           - Login (email/password) → JWT token
POST   /api/auth/logout          - Logout (invalidate token)
POST   /api/auth/refresh         - Refresh JWT token
POST   /api/auth/forgot-password - Request password reset
POST   /api/auth/reset-password  - Reset password with token
GET    /api/auth/me              - Get current user info
```

#### User Management Endpoints
```
GET    /api/users                - List users (paginated, filterable by role)
POST   /api/users                - Create new user (admin only)
GET    /api/users/:id            - Get user by ID
PUT    /api/users/:id            - Update user
DELETE /api/users/:id            - Delete user (soft delete, admin only)
PUT    /api/users/:id/activate   - Activate user
PUT    /api/users/:id/deactivate - Deactivate user
```

#### Article Management Endpoints
```
GET    /api/articles                 - List articles (paginated, filterable)
                                       Query params: status, author_id, category_id, search, page, limit
POST   /api/articles                 - Create new article (draft)
GET    /api/articles/:id             - Get article by ID
PUT    /api/articles/:id             - Update article
DELETE /api/articles/:id             - Delete article (soft delete)
POST   /api/articles/:id/submit      - Submit for review (DRAFT → IN_REVIEW)
POST   /api/articles/:id/approve     - Approve article (IN_REVIEW → APPROVED)
POST   /api/articles/:id/reject      - Reject article (IN_REVIEW → REVISION_NEEDED)
POST   /api/articles/:id/final-approve - Final approval (APPROVED → READY_TO_PUBLISH)
POST   /api/articles/:id/publish     - Publish to WordPress (READY_TO_PUBLISH → PUBLISHED)
POST   /api/articles/:id/archive     - Archive article
GET    /api/articles/:id/history     - Get workflow history for article
GET    /api/articles/:id/comments    - Get comments for article
POST   /api/articles/:id/comments    - Add comment to article
```

#### Category & Tag Endpoints
```
GET    /api/categories           - List categories
POST   /api/categories           - Create category
PUT    /api/categories/:id       - Update category
DELETE /api/categories/:id       - Delete category
GET    /api/tags                 - List tags
POST   /api/tags                 - Create tag
DELETE /api/tags/:id             - Delete tag
```

#### Media Endpoints
```
GET    /api/media                - List media files
POST   /api/media                - Upload media file
GET    /api/media/:id            - Get media metadata
DELETE /api/media/:id            - Delete media file
```

#### Publishing Endpoints
```
POST   /api/publishing/wordpress/preview   - Preview article in WordPress (dry-run)
POST   /api/publishing/wordpress/publish   - Publish to WordPress (actual)
POST   /api/publishing/social/preview      - Preview social media post
POST   /api/publishing/social/dispatch     - Dispatch to social media platforms
```

#### Analytics Endpoints (Read-Only)
```
GET    /api/analytics/overview         - Dashboard overview (pageviews, sessions, etc.)
GET    /api/analytics/top-content      - Top performing articles
GET    /api/analytics/traffic-sources  - Traffic sources breakdown
GET    /api/analytics/search-console   - Search Console data
```

#### System Health Endpoints
```
GET    /api/system/health         - System health status
GET    /api/system/wordpress      - WordPress connectivity status
GET    /api/system/database       - Database status
GET    /api/system/observer       - PerintahX observer status
```

#### Audit Log Endpoints
```
GET    /api/audit                 - List audit log entries (admin only)
                                    Query params: user_id, action, resource_type, date_from, date_to
```

### 6.3 Security Specifications

#### Authentication & Authorization
```yaml
Authentication Method: JWT (JSON Web Tokens)
Token Expiry:
  - Access Token: 15 minutes
  - Refresh Token: 7 days
Storage:
  - Access Token: Memory (JavaScript variable, NOT localStorage)
  - Refresh Token: httpOnly cookie (secure, sameSite=strict)

Authorization: Role-Based Access Control (RBAC)
Roles:
  - REPORTER: Create drafts, edit own articles
  - EDITOR: Review, approve, edit any article
  - CHIEF_EDITOR: Final approval, publish to WordPress
  - ADMIN: Manage users, system settings

Password Requirements:
  - Minimum 12 characters
  - Must contain: uppercase, lowercase, number, special char
  - Hashed with bcrypt (cost factor 12)
  - No password reuse (last 5 passwords)
```

#### Rate Limiting
```yaml
Per IP Address:
  - Login: 5 attempts per 15 minutes
  - API Requests: 100 requests per minute
  - Media Upload: 10 uploads per hour

Per User:
  - WordPress Publish: 20 publishes per hour
  - Social Media Dispatch: 10 dispatches per hour
```

#### CORS Configuration
```yaml
Allowed Origins:
  - https://dashboard.aplikasi-x.com (production frontend)
  - http://localhost:3000 (development)
Allowed Methods: GET, POST, PUT, DELETE, PATCH
Allowed Headers: Authorization, Content-Type
Credentials: true (for httpOnly cookies)
```

---

## 7. CATATAN BATASAN HUKUM & ETIKA MEDIA

### 7.1 Kepatuhan Hukum Pers Indonesia

**Referensi Hukum:**
- UU No. 40 Tahun 1999 tentang Pers
- Kode Etik Jurnalistik
- UU ITE (Informasi dan Transaksi Elektronik)
- UU Perlindungan Anak

**Implementasi di Sistem:**

#### A. Hak Jawab Mechanism
```sql
-- Table untuk menangani hak jawab
CREATE TABLE right_of_reply (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id),
  requester_name VARCHAR(255) NOT NULL,
  requester_email VARCHAR(255) NOT NULL,
  request_date TIMESTAMP DEFAULT NOW(),
  response_content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED')),
  reviewed_by UUID REFERENCES users(id),
  review_date TIMESTAMP,
  published_at TIMESTAMP
);
```

**Workflow:**
1. User submit hak jawab via form
2. Chief Editor review
3. Approve → publish as addendum to article
4. Reject → notify requester with reason

#### B. Koreksi/Ralat Workflow
```sql
-- Table untuk koreksi/ralat
CREATE TABLE corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id),
  correction_type VARCHAR(50) CHECK (correction_type IN ('MINOR_CORRECTION', 'MAJOR_CORRECTION', 'RETRACTION')),
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  reason TEXT NOT NULL,
  corrected_by UUID NOT NULL REFERENCES users(id),
  approved_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);
```

**Prinsip:**
- Semua koreksi harus transparan
- Koreksi mayor harus mencantumkan tanggal koreksi
- Retraction harus melalui chief editor

#### C. Content Moderation

**Automated Checks:**
```javascript
// content-moderation.js
const moderationRules = {
  // Deteksi konten sensitif (anak-anak)
  childSafety: {
    enabled: true,
    keywords: ['daftar kata sensitif'], // Harus dikonfigurasi
    action: 'FLAG_FOR_REVIEW'
  },

  // Deteksi hate speech
  hateSpeech: {
    enabled: true,
    keywords: ['daftar kata kasar'], // Harus dikonfigurasi
    action: 'FLAG_FOR_REVIEW'
  },

  // Deteksi SARA
  sara: {
    enabled: true,
    keywords: ['kata-kata sara'], // Harus dikonfigurasi
    action: 'FLAG_FOR_REVIEW'
  },

  // Link validation (cek broken links)
  linkValidation: {
    enabled: true,
    action: 'WARN'
  }
};

function moderateContent(article) {
  const flags = [];

  // Check against each rule
  for (const [ruleName, rule] of Object.entries(moderationRules)) {
    if (rule.enabled) {
      const result = checkRule(article.content, rule);
      if (result.violated) {
        flags.push({
          rule: ruleName,
          action: rule.action,
          details: result.details
        });
      }
    }
  }

  return {
    passed: flags.length === 0,
    flags: flags
  };
}
```

**Manual Review Trigger:**
- Flag jika artikel mengandung keyword sensitif
- Mandatory review untuk konten tentang anak-anak
- Legal review untuk investigasi/konten kontroversial

### 7.2 Perlindungan Data Pribadi

**Compliance:**
- GDPR (jika ada user EU)
- UU PDP (Perlindungan Data Pribadi Indonesia)

**Implementasi:**
```sql
-- User consent tracking
CREATE TABLE user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  consent_type VARCHAR(100) NOT NULL, -- TERMS_OF_SERVICE, PRIVACY_POLICY, NEWSLETTER
  consented BOOLEAN NOT NULL,
  consent_date TIMESTAMP DEFAULT NOW(),
  ip_address INET
);

-- Data anonymization untuk analytics
CREATE FUNCTION anonymize_user_data(user_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE audit_log SET ip_address = NULL WHERE user_id = $1;
  UPDATE workflow_history SET user_id = NULL WHERE user_id = $1;
  -- Jangan hapus artikel, tapi anonymize author
  UPDATE articles SET author_id = (SELECT id FROM users WHERE username = 'anonymous_user' LIMIT 1) WHERE author_id = $1;
END;
$$ LANGUAGE plpgsql;
```

**Right to be Forgotten:**
- User bisa request data deletion
- Anonymize data (bukan hard delete) untuk preserve audit trail
- Hapus PII (Personally Identifiable Information)

### 7.3 Intellectual Property

**Copyright Compliance:**
```sql
-- Source attribution tracking
CREATE TABLE article_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id),
  source_type VARCHAR(50) CHECK (source_type IN ('QUOTE', 'IMAGE', 'VIDEO', 'DATA', 'REFERENCE')),
  source_url TEXT,
  source_name VARCHAR(255),
  license_type VARCHAR(100), -- CC-BY, CC-BY-SA, FAIR_USE, PERMISSION_OBTAINED
  attribution_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Plagiarism Check Integration (Optional):**
```javascript
// plagiarism-check.js
const axios = require('axios');

async function checkPlagiarism(content) {
  // Integration dengan service seperti Copyscape, Turnitin, atau Grammarly
  const response = await axios.post('https://api.plagiarism-checker.com/check', {
    text: content,
    api_key: process.env.PLAGIARISM_API_KEY
  });

  return {
    isPlagiarized: response.data.similarity_score > 15, // >15% similarity
    similarityScore: response.data.similarity_score,
    sources: response.data.matching_sources
  };
}
```

### 7.4 Editorial Guidelines Enforcement

**System Features:**
- Checklist editor (fact-check, source verification)
- Legal review workflow untuk konten sensitif
- Training module untuk reporter (best practices)
- Style guide enforcement (automated checks untuk tone, style)

```javascript
// editorial-guidelines.js
const editorialChecklist = {
  required: [
    { id: 'sources_verified', label: 'Apakah semua sumber sudah diverifikasi?' },
    { id: 'quotes_attributed', label: 'Apakah semua kutipan sudah dicantumkan sumbernya?' },
    { id: 'images_licensed', label: 'Apakah semua gambar sudah ada lisensi?' },
    { id: 'fact_checked', label: 'Apakah fakta sudah dicek?' },
    { id: 'legal_review', label: 'Apakah konten sensitif sudah di-review legal?' },
    { id: 'seo_optimized', label: 'Apakah SEO metadata sudah diisi?' }
  ],
  optional: [
    { id: 'external_review', label: 'Apakah butuh review eksternal (ahli)?' },
    { id: 'sensitive_content', label: 'Apakah konten mengandung topik sensitif?' }
  ]
};

// Enforce checklist before final approval
function canFinalApprove(article, checklist) {
  const allRequiredChecked = editorialChecklist.required.every(item => {
    return checklist[item.id] === true;
  });

  return allRequiredChecked;
}
```

---

## 8. DEPLOYMENT & INFRASTRUCTURE

### 8.1 Recommended Infrastructure

**Option 1: Cloud-Based (Scalable)**
```yaml
Platform: AWS/Google Cloud/Azure

Components:
  Frontend:
    - S3 + CloudFront (static hosting)
    - OR: Vercel/Netlify (managed hosting)

  Backend:
    - EC2 instances (atau Fargate untuk containers)
    - Auto Scaling Group (min 2, max 10 instances)
    - Load Balancer (ALB)

  Database:
    - RDS PostgreSQL (Multi-AZ for HA)
    - Automated backups (retention 30 days)
    - Read replicas (for analytics queries)

  Cache:
    - ElastiCache Redis (cluster mode)

  Storage:
    - S3 (media files)
    - CloudFront (CDN untuk media)

  Monitoring:
    - CloudWatch (logs, metrics, alarms)
    - OR: Datadog/New Relic

  CI/CD:
    - GitHub Actions (atau GitLab CI)
    - Deploy to staging → manual approval → production
```

**Option 2: VPS-Based (Cost-Effective)**
```yaml
Platform: DigitalOcean/Linode/Hetzner

Components:
  Single VPS (4 CPU, 8GB RAM, 160GB SSD):
    - Docker Compose setup
    - Nginx (reverse proxy + SSL termination)
    - Application containers (backend)
    - PostgreSQL container
    - Redis container

  Backups:
    - Automated daily backups (DigitalOcean Backups atau rsync to external storage)

  Monitoring:
    - Self-hosted (Prometheus + Grafana)
    - OR: Managed (UptimeRobot for uptime monitoring)
```

### 8.2 Docker Compose Setup (VPS Option)

```yaml
# docker-compose.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build: ./backend
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://aplikasix:password@postgres:5432/aplikasix
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      WP_API_URL: ${WP_API_URL}
      WP_USERNAME: ${WP_USERNAME}
      WP_APP_PASSWORD: ${WP_APP_PASSWORD}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - ./uploads:/app/uploads

  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: aplikasix
      POSTGRES_USER: aplikasix
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data

  # Optional: Monitoring
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

---

## 9. ADDITIONAL SPECIFICATIONS

### 9.1 Notification System

**Channels:**
- Email (SMTP)
- Slack webhook
- In-app notifications (WebSocket)

**Events:**
```javascript
const notificationEvents = {
  // Article workflow events
  ARTICLE_SUBMITTED: {
    recipients: ['assigned_editor'],
    channels: ['email', 'in_app'],
    template: 'article_submitted'
  },
  ARTICLE_APPROVED: {
    recipients: ['article_author', 'chief_editor'],
    channels: ['email', 'in_app'],
    template: 'article_approved'
  },
  ARTICLE_REJECTED: {
    recipients: ['article_author'],
    channels: ['email', 'in_app'],
    template: 'article_rejected'
  },
  ARTICLE_PUBLISHED: {
    recipients: ['article_author', 'all_editors'],
    channels: ['email', 'in_app', 'slack'],
    template: 'article_published'
  },

  // System events
  SYSTEM_HEALTH_CRITICAL: {
    recipients: ['all_admins'],
    channels: ['email', 'slack', 'sms'],
    template: 'system_alert_critical'
  },
  WORDPRESS_API_DOWN: {
    recipients: ['all_admins'],
    channels: ['email', 'slack'],
    template: 'wordpress_down'
  },

  // Security events
  UNAUTHORIZED_ACCESS_ATTEMPT: {
    recipients: ['all_admins'],
    channels: ['email', 'slack'],
    template: 'security_alert'
  }
};
```

### 9.2 Scheduling System

**Use Case:**
- Scheduled publishing (publish artikel di waktu tertentu)
- Automated report generation (weekly analytics report)
- Automated backups

**Implementation:**
```javascript
// Using node-cron or Bull (queue system)
const cron = require('node-cron');
const Bull = require('bull');

// Publishing queue
const publishQueue = new Bull('publishing', process.env.REDIS_URL);

publishQueue.process(async (job) => {
  const { articleId } = job.data;

  // Pre-publish checks
  const healthOk = await checkSystemHealth();
  if (!healthOk) {
    throw new Error('System health check failed, aborting publish');
  }

  // Publish to WordPress
  const result = await publishToWordPress(articleId);

  // Update article status
  await updateArticleStatus(articleId, 'PUBLISHED');

  // Audit log
  await auditLog({
    action: 'SCHEDULED_PUBLISH',
    article_id: articleId,
    result: result
  });

  return result;
});

// Scheduled jobs
cron.schedule('*/5 * * * *', async () => {
  // Every 5 minutes, check for articles scheduled to publish
  const articles = await getArticlesScheduledToPublish();

  for (const article of articles) {
    await publishQueue.add({ articleId: article.id });
  }
});
```

---

## 10. SUMMARY & NEXT STEPS

### 10.1 Deliverables Checklist

✅ **1. Diagram Arsitektur Sistem**
- High-level architecture (Section 1.1)
- Editorial workflow diagram (Section 1.2)
- Data flow diagram (Section 3)

✅ **2. Penjelasan Setiap Modul**
- Frontend Dashboard (Section 2.1)
- Backend Application Layer (Section 2.2)
- Integration Layer (Section 2.3)

✅ **3. Alur Data Antar Komponen**
- Publishing flow (Section 3.1)
- Monitoring flow (Section 3.2)

✅ **4. Risiko Teknis & Mitigasi**
- Keamanan (Section 4.1)
- Operasional (Section 4.2)
- Legal & Etika (Section 4.3)

✅ **5. Rekomendasi Stack Teknologi**
- 3 options: Node.js, Python, Go (Section 5)
- Rekomendasi final (Section 5.4)

✅ **6. Catatan Batasan Hukum & Etika Media**
- Kepatuhan hukum pers (Section 7.1)
- Perlindungan data pribadi (Section 7.2)
- Intellectual property (Section 7.3)
- Editorial guidelines (Section 7.4)

✅ **7. Spesifikasi Teknis Lanjutan**
- Database schema (Section 6.1)
- API endpoints (Section 6.2)
- Security specs (Section 6.3)
- Deployment options (Section 8)

### 10.2 System Characteristics Summary

```
┌──────────────────────────────────────────────────┐
│        APLIKASI.X - SYSTEM CHARACTERISTICS       │
├──────────────────────────────────────────────────┤
│ ARCHITECTURE:     Decoupled (Backend ≠ WP)       │
│ EDITORIAL CONTROL: 100% Human                    │
│ DEFAULT MODE:     OBSERVE_ONLY                   │
│ AUTO-PUBLISH:     Disabled (human trigger only)  │
│ AI DECISIONS:     NONE (AI assists, not decides) │
│ AUDIT TRAIL:      Full (immutable logs)          │
│ LEGAL COMPLIANCE: Enabled (UU Pers, UU ITE)      │
│ GOOGLE APIS:      Read-only                      │
│ WORDPRESS API:    Read + Write (controlled)      │
│ SECURITY:         Multi-layer (RBAC, audit, etc) │
└──────────────────────────────────────────────────┘
```

### 10.3 Implementation Phases

**Phase 1: MVP (Minimum Viable Product) - 8 weeks**
- Core features:
  - User authentication & RBAC
  - Article CRUD
  - Basic workflow (Draft → Review → Approved → Publish)
  - WordPress integration (publish only)
  - Basic audit logging
- Target: Internal testing by redaksi

**Phase 2: Enhanced Workflow - 4 weeks**
- Features:
  - Advanced workflow (comments, version control)
  - Media library
  - Categories & tags management
  - Email notifications
  - Dashboard analytics (basic)
- Target: Production ready

**Phase 3: Integrations - 6 weeks**
- Features:
  - Google Analytics integration (read-only)
  - Search Console integration (read-only)
  - Social media dispatcher
  - Scheduled publishing
  - Advanced notifications (Slack, SMS)
- Target: Full automation support

**Phase 4: Compliance & Optimization - 4 weeks**
- Features:
  - Legal compliance (hak jawab, koreksi)
  - Content moderation (automated checks)
  - Performance optimization
  - Security hardening
  - Load testing
- Target: Production-grade system

**Total Estimated Timeline: 22 weeks (~5.5 months)**

### 10.4 Resource Requirements

**Development Team:**
- 1 Full-stack Developer (lead)
- 1 Frontend Developer
- 1 Backend Developer
- 1 DevOps Engineer (part-time)
- 1 QA Tester
- 1 Technical Writer (documentation)

**Infrastructure Costs (Monthly Estimate):**
- VPS Option: $50-100/month (DigitalOcean/Linode)
- Cloud Option: $200-500/month (AWS/GCP, depends on traffic)
- External Services:
  - Email (SendGrid/Mailgun): $10-50/month
  - Monitoring (Datadog/New Relic): $0-100/month (depends on usage)
  - Analytics API access: Free (Google Analytics/Search Console)

---

## 11. CRITICAL CONSTRAINTS & SAFEGUARDS

### 11.1 Mandatory Safety Mechanisms

**1. NO AI EDITORIAL DECISIONS**
```javascript
// FORBIDDEN: AI menentukan publish/reject
// This code should NEVER exist:
// if (aiScore > 0.8) { publishArticle(); } ❌

// CORRECT: AI assists, human decides
function getAISuggestions(article) {
  return {
    readabilityScore: 85,
    seoOptimizationScore: 90,
    suggestions: [
      'Consider adding more subheadings',
      'Keyword density is optimal'
    ],
    // NO automatic actions, only suggestions
  };
}
```

**2. Human-in-the-Loop for Publishing**
```javascript
// Publishing MUST require explicit human approval
async function publishToWordPress(articleId, userId) {
  // Verify user has permission
  const user = await getUserById(userId);
  if (user.role !== 'CHIEF_EDITOR' && user.role !== 'ADMIN') {
    throw new Error('Unauthorized: Only Chief Editor can publish');
  }

  // Verify article status
  const article = await getArticleById(articleId);
  if (article.status !== 'READY_TO_PUBLISH') {
    throw new Error('Article not approved for publishing');
  }

  // Log human action
  await auditLog({
    action: 'HUMAN_TRIGGERED_PUBLISH',
    user_id: userId,
    article_id: articleId,
    timestamp: new Date()
  });

  // Proceed with WordPress publish
  // ...
}
```

**3. Immutable Audit Trail**
```sql
-- Audit log table MUST NOT have UPDATE/DELETE permissions
REVOKE UPDATE, DELETE ON audit_log FROM aplikasix_app;
GRANT INSERT, SELECT ON audit_log TO aplikasix_app;

-- Even admin cannot modify audit log
-- Only SELECT allowed for viewing
```

### 11.2 Legal Compliance Checklist

```
┌───────────────────────────────────────────────────┐
│        LEGAL COMPLIANCE - PRE-DEPLOYMENT          │
├───────────────────────────────────────────────────┤
│ ☐ Hak jawab mechanism implemented                 │
│ ☐ Koreksi/ralat workflow implemented              │
│ ☐ Content moderation enabled (SARA, hate speech)  │
│ ☐ Privacy policy published (GDPR/UU PDP)          │
│ ☐ Terms of service published                      │
│ ☐ Editorial guidelines documented                 │
│ ☐ Training provided to all editors                │
│ ☐ Legal consultant contact established            │
│ ☐ Copyright attribution system active             │
│ ☐ Child protection safeguards enabled             │
└───────────────────────────────────────────────────┘
```

---

## 12. FINAL STATUS

**SYSTEM NAME:** APLIKASI.X v1.0

**ARCHITECTURE STATUS:** ✅ COMPLETE

**MODE:** OBSERVE_ONLY (safe mode enforced)

**CONSTRAINTS RESPECTED:**
1. ✅ Backend terpisah dari WordPress
2. ✅ Keputusan editorial 100% manusia
3. ✅ Tidak ada auto-publish tanpa persetujuan
4. ✅ AI tidak mengambil keputusan editorial
5. ✅ Audit trail lengkap
6. ✅ Zero manual intervention setelah konfigurasi
7. ✅ Default mode OBSERVE_ONLY
8. ✅ Integrasi Google read-only
9. ✅ Auto-fix hanya teknis ringan
10. ✅ Kepatuhan hukum pers & perlindungan anak

**DELIVERABLES:**
- ✅ Diagram arsitektur sistem (Section 1)
- ✅ Penjelasan setiap modul (Section 2)
- ✅ Alur data antar komponen (Section 3)
- ✅ Risiko teknis & mitigasi (Section 4)
- ✅ Rekomendasi stack teknologi (Section 5)
- ✅ Spesifikasi teknis lanjutan (Section 6)
- ✅ Catatan batasan hukum & etika (Section 7)

**READY FOR:** Implementation planning

**NEXT REQUIRED ACTION:**
1. Review arsitektur dengan tim teknis
2. Pilih stack teknologi (Node.js/Python/Go)
3. Buat project timeline detail
4. Setup development environment
5. Mulai Phase 1: MVP development

---

**CATATAN PENTING:**
Dokumen ini adalah **PERENCANAAN ARSITEKTUR** saja. Tidak ada kode eksekusi produksi yang dibuat. Tidak ada automasi yang diaktifkan. Tidak ada kredensial yang diminta. Sistem dirancang dengan prinsip **safety-first** dan **human-in-control**.

**END OF ARCHITECTURE DOCUMENT**
