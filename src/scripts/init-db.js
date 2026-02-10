import { getDB, closeDB } from '../config/database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '../../data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const db = getDB();

const schema = `
  -- Users Table
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('Admin_Teknis', 'Reporter', 'Redaktur', 'Pemred')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Drafts Table
  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'published')),
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Social Media Publications Table
  CREATE TABLE IF NOT EXISTS social_publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id INTEGER NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('facebook', 'twitter', 'instagram')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'published', 'failed', 'scheduled')),
    scheduled_time DATETIME,
    published_url TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (draft_id) REFERENCES drafts(id)
  );

  -- WordPress Posts Table
  CREATE TABLE IF NOT EXISTS wordpress_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    draft_id INTEGER NOT NULL,
    wp_post_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'uploaded', 'failed')),
    wp_url TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (draft_id) REFERENCES drafts(id)
  );

  -- Servers Table
  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'unknown' CHECK(status IN ('online', 'offline', 'unknown')),
    last_check DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Services Table
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    server_id INTEGER NOT NULL,
    status TEXT DEFAULT 'unknown' CHECK(status IN ('running', 'stopped', 'error', 'unknown')),
    last_check DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (server_id) REFERENCES servers(id)
  );

  -- Alerts Table
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('email', 'webhook', 'sms')),
    recipient TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Auto Fixes Table
  CREATE TABLE IF NOT EXISTS auto_fixes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    fix_type TEXT NOT NULL CHECK(fix_type IN ('restart_service', 'clear_cache', 'reconnect_api', 'refresh_token')),
    target TEXT NOT NULL,
    status TEXT DEFAULT 'available' CHECK(status IN ('available', 'running', 'completed', 'failed')),
    last_executed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Audit Logs Table
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT NOT NULL,
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Analytics Cache Table
  CREATE TABLE IF NOT EXISTS analytics_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    metric TEXT NOT NULL,
    value TEXT NOT NULL,
    cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

db.serialize(() => {
  const statements = schema.split(';').filter(stmt => stmt.trim());

  statements.forEach((stmt) => {
    if (stmt.trim()) {
      db.run(stmt, (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        }
      });
    }
  });

  // Create default admin user
  const defaultPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');

  db.run(
    `INSERT OR IGNORE INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)`,
    ['admin', 'admin@doktor.local', passwordHash, 'Admin_Teknis'],
    (err) => {
      if (err) {
        console.error('Error creating default user:', err.message);
      } else {
        console.log('Database initialized successfully!');
        console.log('Default admin user created:');
        console.log('  Username: admin');
        console.log('  Password:', defaultPassword);
        console.log('  Email: admin@doktor.local');
        console.log('  Role: Admin_Teknis');
        console.log('\nPlease change the password after first login!');
      }
      closeDB();
    }
  );
});
