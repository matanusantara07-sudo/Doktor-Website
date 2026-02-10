-- ============================================
-- APLIKASI.X DATABASE SCHEMA v1.0
-- PostgreSQL 14+
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

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
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = TRUE;

-- ============================================
-- ARTICLES
-- ============================================

CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
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
CREATE INDEX idx_articles_slug ON articles(slug);

-- ============================================
-- CATEGORIES
-- ============================================

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
CREATE INDEX idx_categories_parent ON categories(parent_id) WHERE parent_id IS NOT NULL;

-- Article-Category Mapping (Many-to-Many)
CREATE TABLE article_categories (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, category_id)
);

CREATE INDEX idx_article_categories_article ON article_categories(article_id);
CREATE INDEX idx_article_categories_category ON article_categories(category_id);

-- ============================================
-- TAGS
-- ============================================

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  wordpress_tag_id INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tags_slug ON tags(slug);

-- Article-Tag Mapping (Many-to-Many)
CREATE TABLE article_tags (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX idx_article_tags_article ON article_tags(article_id);
CREATE INDEX idx_article_tags_tag ON article_tags(tag_id);

-- ============================================
-- WORKFLOW HISTORY
-- ============================================

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
CREATE INDEX idx_workflow_action ON workflow_history(action, timestamp DESC);

-- ============================================
-- COMMENTS/FEEDBACK
-- ============================================

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
CREATE INDEX idx_comments_unresolved ON article_comments(article_id, is_resolved) WHERE is_resolved = FALSE;

-- ============================================
-- MEDIA LIBRARY
-- ============================================

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
CREATE INDEX idx_media_wp_id ON media(wordpress_media_id) WHERE wordpress_media_id IS NOT NULL;

-- ============================================
-- AUDIT LOG (Immutable)
-- ============================================

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
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);

-- Prevent UPDATE/DELETE on audit_log (immutable)
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- ============================================
-- SYSTEM SETTINGS
-- ============================================

CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PUBLISHING QUEUE
-- ============================================

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
CREATE INDEX idx_queue_status ON publishing_queue(status) WHERE status = 'PENDING';

-- ============================================
-- ANALYTICS CACHE
-- ============================================

CREATE TABLE analytics_cache (
  id BIGSERIAL PRIMARY KEY,
  metric_type VARCHAR(100) NOT NULL, -- PAGEVIEWS, SESSIONS, BOUNCE_RATE
  date DATE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_type, date)
);

CREATE INDEX idx_analytics_date ON analytics_cache(metric_type, date DESC);

-- ============================================
-- LEGAL COMPLIANCE TABLES
-- ============================================

-- Right of Reply (Hak Jawab)
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

CREATE INDEX idx_right_of_reply_article ON right_of_reply(article_id);
CREATE INDEX idx_right_of_reply_status ON right_of_reply(status);

-- Corrections/Retractions (Koreksi/Ralat)
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

CREATE INDEX idx_corrections_article ON corrections(article_id, created_at DESC);

-- Source Attribution
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

CREATE INDEX idx_article_sources_article ON article_sources(article_id);

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default admin user (password: Admin123!)
-- IMPORTANT: Change this password immediately after first login
INSERT INTO users (username, email, password_hash, full_name, role, is_active) VALUES
('admin', 'admin@aplikasi-x.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWHvqqvG', 'System Administrator', 'ADMIN', TRUE);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
('system_mode', '"OBSERVE_ONLY"', 'System operation mode: OBSERVE_ONLY | SEMI_AUTOMATION | FULL_AUTOMATION'),
('auto_publish_enabled', 'false', 'Enable automatic publishing to WordPress'),
('max_publish_per_hour', '5', 'Maximum articles to publish per hour'),
('editorial_guidelines_url', '""', 'URL to editorial guidelines document'),
('legal_review_required_keywords', '[]', 'Keywords that trigger mandatory legal review');

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_article_comments_updated_at BEFORE UPDATE ON article_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-log workflow changes
CREATE OR REPLACE FUNCTION log_article_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO workflow_history (article_id, user_id, action, from_status, to_status)
        VALUES (NEW.id, NEW.author_id, 'STATUS_CHANGE', OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER article_status_change_trigger AFTER UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION log_article_status_change();

-- ============================================
-- VIEWS
-- ============================================

-- Active articles by status
CREATE VIEW v_articles_by_status AS
SELECT 
    status,
    COUNT(*) as count,
    COUNT(DISTINCT author_id) as unique_authors
FROM articles
WHERE status != 'ARCHIVED'
GROUP BY status;

-- User productivity
CREATE VIEW v_user_productivity AS
SELECT 
    u.id,
    u.username,
    u.full_name,
    u.role,
    COUNT(DISTINCT a.id) as total_articles,
    COUNT(DISTINCT CASE WHEN a.status = 'PUBLISHED' THEN a.id END) as published_articles,
    MAX(a.created_at) as last_article_date
FROM users u
LEFT JOIN articles a ON u.id = a.author_id
WHERE u.is_active = TRUE
GROUP BY u.id, u.username, u.full_name, u.role;

-- ============================================
-- GRANTS (Adjust based on your user setup)
-- ============================================

-- Example: Grant permissions to application user
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO aplikasi_x_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aplikasi_x_user;
-- REVOKE UPDATE, DELETE ON audit_log FROM aplikasi_x_user;

-- ============================================
-- END OF SCHEMA
-- ============================================
