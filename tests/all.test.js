/**
 * Comprehensive test suite for Doktor-Website.
 * Tests all modules, RBAC enforcement, and command workflows.
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const EXPORT_DIR = path.join(ROOT, 'exports');

// Helpers to clean data between tests
function cleanData() {
  if (fs.existsSync(DATA_DIR)) {
    for (const file of fs.readdirSync(DATA_DIR)) {
      fs.unlinkSync(path.join(DATA_DIR, file));
    }
  }
}

function seedAdmin() {
  const { hashPassword } = await_import_auth;
  const db = await_import_db;
  const { hash, salt } = hashPassword('changeme123');
  db.insert('users', { username: 'admin', email: 'admin@test.id', role: 'Admin_Teknis', passwordHash: hash, passwordSalt: salt, active: true });
  db.insert('users', { username: 'reporter1', email: 'r1@test.id', role: 'Reporter', passwordHash: hash, passwordSalt: salt, active: true });
  db.insert('users', { username: 'redaktur1', email: 'red1@test.id', role: 'Redaktur', passwordHash: hash, passwordSalt: salt, active: true });
  db.insert('users', { username: 'pemred1', email: 'p1@test.id', role: 'Pemred', passwordHash: hash, passwordSalt: salt, active: true });
}

// Dynamic imports (ESM)
let await_import_db;
let await_import_auth;
let await_import_users;
let await_import_content;
let await_import_social;
let await_import_wordpress;
let await_import_monitoring;
let await_import_alerts;
let await_import_autofix;
let await_import_analytics;
let await_import_audit;

before(async () => {
  await_import_db = (await import('../src/database.js')).default;
  await_import_auth = await import('../src/auth.js');
  await_import_users = await import('../src/modules/users.js');
  await_import_content = await import('../src/modules/content.js');
  await_import_social = await import('../src/modules/social.js');
  await_import_wordpress = await import('../src/modules/wordpress.js');
  await_import_monitoring = await import('../src/modules/monitoring.js');
  await_import_alerts = await import('../src/modules/alerts.js');
  await_import_autofix = await import('../src/modules/autofix.js');
  await_import_analytics = await import('../src/modules/analytics.js');
  await_import_audit = await import('../src/modules/audit.js');
});

// ─── AUTH ────────────────────────────────────────────────────────────────────

describe('Auth Module', () => {
  beforeEach(() => cleanData());

  it('should hash and verify passwords', () => {
    const { hashPassword, verifyPassword } = await_import_auth;
    const { hash, salt } = hashPassword('testpass');
    assert.ok(hash);
    assert.ok(salt);
    assert.ok(verifyPassword('testpass', hash, salt));
    assert.ok(!verifyPassword('wrongpass', hash, salt));
  });

  it('should validate roles', () => {
    const { isValidRole } = await_import_auth;
    assert.ok(isValidRole('Admin_Teknis'));
    assert.ok(isValidRole('Reporter'));
    assert.ok(!isValidRole('SuperAdmin'));
    assert.ok(!isValidRole(''));
  });

  it('should authorize valid roles', () => {
    const { isAuthorized } = await_import_auth;
    assert.ok(isAuthorized('Admin_Teknis', ['Admin_Teknis']));
    assert.ok(!isAuthorized('Reporter', ['Admin_Teknis']));
    assert.ok(isAuthorized('Reporter', ['Reporter', 'Redaktur']));
  });

  it('should resolve existing user', () => {
    seedAdmin();
    const { resolveUser } = await_import_auth;
    const result = resolveUser('admin');
    assert.ok(result.success);
    assert.equal(result.user.username, 'admin');
  });

  it('should fail to resolve non-existent user', () => {
    seedAdmin();
    const { resolveUser } = await_import_auth;
    const result = resolveUser('ghost');
    assert.ok(!result.success);
  });

  it('should deny unauthorized access', () => {
    seedAdmin();
    const { authorize } = await_import_auth;
    const result = authorize('reporter1', ['Admin_Teknis']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Access denied'));
  });
});

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

describe('User Management Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should create a new user', () => {
    const result = await_import_users.createUser('admin', ['newuser', 'new@test.id', 'Reporter']);
    assert.ok(result.success);
    assert.ok(result.data.username === 'newuser');
  });

  it('should reject duplicate user creation', () => {
    const result = await_import_users.createUser('admin', ['admin', 'dup@test.id', 'Reporter']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('already exists'));
  });

  it('should reject invalid role on create', () => {
    const result = await_import_users.createUser('admin', ['x', 'x@test.id', 'InvalidRole']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Invalid role'));
  });

  it('should deny non-admin from creating users', () => {
    const result = await_import_users.createUser('reporter1', ['x', 'x@test.id', 'Reporter']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Access denied'));
  });

  it('should delete a user', () => {
    const result = await_import_users.deleteUser('admin', ['reporter1']);
    assert.ok(result.success);
  });

  it('should not delete self', () => {
    const result = await_import_users.deleteUser('admin', ['admin']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Cannot delete your own'));
  });

  it('should update user role', () => {
    const result = await_import_users.updateUserRole('admin', ['reporter1', 'Redaktur']);
    assert.ok(result.success);
    assert.ok(result.message.includes('Redaktur'));
  });

  it('should reset password', () => {
    const result = await_import_users.resetPassword('admin', ['reporter1']);
    assert.ok(result.success);
  });

  it('should list users', () => {
    const result = await_import_users.listUsers('admin');
    assert.ok(result.success);
    assert.ok(result.data.length >= 4);
  });
});

// ─── CONTENT MANAGEMENT ─────────────────────────────────────────────────────

describe('Content Management Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should submit a draft', () => {
    const result = await_import_content.submitDraft('reporter1', ['D001', 'Test Title', 'Test content body', 'reporter1']);
    assert.ok(result.success);
    assert.equal(result.data.draftId, 'D001');
    assert.equal(result.data.status, 'submitted');
  });

  it('should reject duplicate draft ID', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    const result = await_import_content.submitDraft('reporter1', ['D001', 'Title2', 'Content2', 'reporter1']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('already exists'));
  });

  it('should edit a draft', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    const result = await_import_content.editDraft('reporter1', ['D001', 'title=Updated Title']);
    assert.ok(result.success);
    assert.ok(result.message.includes('title'));
  });

  it('should prevent reporter from editing others draft', () => {
    await_import_content.submitDraft('redaktur1', ['D001', 'Title', 'Content', 'redaktur1']);
    const result = await_import_content.editDraft('reporter1', ['D001', 'title=Hacked']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('own drafts'));
  });

  it('should approve a draft', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    const result = await_import_content.approveDraft('redaktur1', ['D001']);
    assert.ok(result.success);
    assert.ok(result.message.includes('approved'));
  });

  it('should reject a draft with reason', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    const result = await_import_content.rejectDraft('redaktur1', ['D001', 'Needs', 'more', 'detail']);
    assert.ok(result.success);
    assert.ok(result.message.includes('rejected'));
    assert.ok(result.message.includes('Needs more detail'));
  });

  it('should list drafts by status', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title1', 'Content1', 'reporter1']);
    await_import_content.submitDraft('reporter1', ['D002', 'Title2', 'Content2', 'reporter1']);
    await_import_content.approveDraft('redaktur1', ['D001']);

    const submitted = await_import_content.listDrafts('redaktur1', ['submitted']);
    assert.ok(submitted.success);
    assert.equal(submitted.data.length, 1);

    const approved = await_import_content.listDrafts('redaktur1', ['approved']);
    assert.ok(approved.success);
    assert.equal(approved.data.length, 1);
  });

  it('should deny reporter from approving', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    const result = await_import_content.approveDraft('reporter1', ['D001']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Access denied'));
  });
});

// ─── SOCIAL MEDIA ────────────────────────────────────────────────────────────

describe('Social Media Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should publish to social media', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    await_import_content.approveDraft('redaktur1', ['D001']);
    const result = await_import_social.publishSocial('pemred1', ['D001', 'twitter,facebook']);
    assert.ok(result.success);
    assert.ok(result.message.includes('published'));
  });

  it('should reject unapproved draft for social publish', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    const result = await_import_social.publishSocial('pemred1', ['D001', 'twitter']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('approved'));
  });

  it('should reject invalid platform', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    await_import_content.approveDraft('redaktur1', ['D001']);
    const result = await_import_social.publishSocial('pemred1', ['D001', 'myspace']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Invalid platform'));
  });

  it('should retry publish', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    await_import_content.approveDraft('redaktur1', ['D001']);
    await_import_social.publishSocial('pemred1', ['D001', 'twitter']);
    const result = await_import_social.retryPublish('admin', ['D001', 'twitter']);
    assert.ok(result.success);
  });

  it('should check status (all roles)', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    await_import_content.approveDraft('redaktur1', ['D001']);
    await_import_social.publishSocial('pemred1', ['D001', 'twitter']);
    const result = await_import_social.checkStatus('reporter1', ['D001', 'twitter']);
    assert.ok(result.success);
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].platform, 'twitter');
  });
});

// ─── WORDPRESS ───────────────────────────────────────────────────────────────

describe('WordPress Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should upload draft to WordPress', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    await_import_content.approveDraft('redaktur1', ['D001']);
    const result = await_import_wordpress.uploadWp('admin', ['D001']);
    assert.ok(result.success);
    assert.ok(result.data.wpPostId);
  });

  it('should reject unapproved draft for WP upload', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    const result = await_import_wordpress.uploadWp('admin', ['D001']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('approved'));
  });

  it('should reject duplicate WP upload', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    await_import_content.approveDraft('redaktur1', ['D001']);
    await_import_wordpress.uploadWp('admin', ['D001']);
    const result = await_import_wordpress.uploadWp('admin', ['D001']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('already been uploaded'));
  });

  it('should update WP status', () => {
    await_import_content.submitDraft('reporter1', ['D001', 'Title', 'Content', 'reporter1']);
    await_import_content.approveDraft('redaktur1', ['D001']);
    await_import_wordpress.uploadWp('admin', ['D001']);
    const result = await_import_wordpress.updateWpStatus('admin', ['D001', 'publish']);
    assert.ok(result.success);
    assert.ok(result.message.includes('publish'));
  });

  it('should check WP connection', () => {
    const result = await_import_wordpress.checkWpConnection('admin');
    assert.ok(result.success);
    assert.ok(result.data.connected);
  });

  it('should deny non-admin from WP operations', () => {
    const result = await_import_wordpress.checkWpConnection('reporter1');
    assert.ok(!result.success);
    assert.ok(result.message.includes('Access denied'));
  });
});

// ─── MONITORING ──────────────────────────────────────────────────────────────

describe('Monitoring Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should ping a server', () => {
    const result = await_import_monitoring.pingServer('admin', ['https://example.com']);
    assert.ok(result.success);
    assert.ok(result.data.latencyMs > 0);
  });

  it('should check an API', () => {
    const result = await_import_monitoring.checkApi('admin', ['https://api.example.com/health']);
    assert.ok(result.success);
    assert.equal(result.data.httpStatus, 200);
  });

  it('should check a service', () => {
    const result = await_import_monitoring.checkService('admin', ['nginx', 'https://server1.com']);
    assert.ok(result.success);
    assert.equal(result.data.status, 'running');
  });

  it('should list servers', () => {
    await_import_monitoring.pingServer('admin', ['https://s1.com']);
    await_import_monitoring.pingServer('admin', ['https://s2.com']);
    const result = await_import_monitoring.listServers('admin');
    assert.ok(result.success);
    assert.equal(result.data.length, 2);
  });

  it('should list services', () => {
    await_import_monitoring.checkService('admin', ['nginx', 'https://s1.com']);
    const result = await_import_monitoring.listServices('admin');
    assert.ok(result.success);
    assert.equal(result.data.length, 1);
  });

  it('should deny non-admin from monitoring', () => {
    const result = await_import_monitoring.pingServer('reporter1', ['https://example.com']);
    assert.ok(!result.success);
  });
});

// ─── ALERTS ──────────────────────────────────────────────────────────────────

describe('Alerts Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should enable an alert', () => {
    const result = await_import_alerts.enableAlert('admin', ['email', 'admin@test.id']);
    assert.ok(result.success);
  });

  it('should reject duplicate enable', () => {
    await_import_alerts.enableAlert('admin', ['email', 'admin@test.id']);
    const result = await_import_alerts.enableAlert('admin', ['email', 'admin@test.id']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('already enabled'));
  });

  it('should disable an alert', () => {
    await_import_alerts.enableAlert('admin', ['email', 'admin@test.id']);
    const result = await_import_alerts.disableAlert('admin', ['email', 'admin@test.id']);
    assert.ok(result.success);
  });

  it('should list alerts', () => {
    await_import_alerts.enableAlert('admin', ['email', 'a@test.id']);
    await_import_alerts.enableAlert('admin', ['sms', '+628123']);
    const result = await_import_alerts.listAlerts('admin');
    assert.ok(result.success);
    assert.equal(result.data.length, 2);
  });

  it('should test an alert', () => {
    const result = await_import_alerts.testAlert('admin', ['telegram', '@channel']);
    assert.ok(result.success);
    assert.ok(result.data.delivered);
  });

  it('should reject invalid alert type', () => {
    const result = await_import_alerts.enableAlert('admin', ['pigeon', 'admin@test.id']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Invalid alert type'));
  });
});

// ─── AUTO-FIX ────────────────────────────────────────────────────────────────

describe('Auto-Fix Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should restart a service', () => {
    const result = await_import_autofix.restartService('admin', ['nginx', 'https://s1.com']);
    assert.ok(result.success);
    assert.ok(result.data.fixId);
  });

  it('should clear cache', () => {
    const result = await_import_autofix.clearCache('admin', ['https://s1.com']);
    assert.ok(result.success);
    assert.ok(result.data.clearedMb > 0);
  });

  it('should reconnect API', () => {
    const result = await_import_autofix.reconnectApi('admin', ['https://api.example.com']);
    assert.ok(result.success);
    assert.equal(result.data.status, 'connected');
  });

  it('should refresh token', () => {
    const result = await_import_autofix.refreshToken('admin', ['twitter']);
    assert.ok(result.success);
    assert.ok(result.data.expiresAt);
  });

  it('should list fixes', () => {
    await_import_autofix.clearCache('admin', ['https://s1.com']);
    await_import_autofix.refreshToken('admin', ['facebook']);
    const result = await_import_autofix.listFixes('admin');
    assert.ok(result.success);
    assert.equal(result.data.length, 2);
  });

  it('should deny non-admin from auto-fix', () => {
    const result = await_import_autofix.clearCache('reporter1', ['https://s1.com']);
    assert.ok(!result.success);
  });
});

// ─── ANALYTICS ───────────────────────────────────────────────────────────────

describe('Analytics Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should check analytics', () => {
    const result = await_import_analytics.checkAnalytics('admin', ['pageviews', 'google_analytics']);
    assert.ok(result.success);
    assert.ok(result.data.value > 0);
  });

  it('should reject invalid metric', () => {
    const result = await_import_analytics.checkAnalytics('admin', ['invalid_metric', 'ga']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Invalid metric'));
  });

  it('should check ads', () => {
    const result = await_import_analytics.checkAds('admin', ['CAMP001']);
    assert.ok(result.success);
    assert.ok(result.data.impressions > 0);
  });

  it('should check adsense', () => {
    const result = await_import_analytics.checkAdsense('admin', ['SITE001']);
    assert.ok(result.success);
    assert.ok(result.data.estimatedEarnings >= 0);
  });

  it('should list metrics', () => {
    const result = await_import_analytics.listMetrics('admin');
    assert.ok(result.success);
    assert.equal(result.data.length, 5);
  });
});

// ─── AUDIT ───────────────────────────────────────────────────────────────────

describe('Audit Module', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should list audit logs', () => {
    // Perform some actions to generate logs
    await_import_users.listUsers('admin');
    await_import_users.listUsers('admin');
    const result = await_import_audit.listLogs('admin', []);
    assert.ok(result.success);
    assert.ok(result.data.length >= 2);
  });

  it('should filter logs by user', () => {
    await_import_users.listUsers('admin');
    const result = await_import_audit.filterLogs('admin', ['user=admin']);
    assert.ok(result.success);
    assert.ok(result.data.length >= 1);
    assert.ok(result.data.every((l) => l.username === 'admin'));
  });

  it('should filter logs by module', () => {
    await_import_users.listUsers('admin');
    const result = await_import_audit.filterLogs('admin', ['module=USERS']);
    assert.ok(result.success);
    assert.ok(result.data.every((l) => l.module === 'USERS'));
  });

  it('should filter logs by action', () => {
    await_import_users.listUsers('admin');
    const result = await_import_audit.filterLogs('admin', ['action=LIST_USERS']);
    assert.ok(result.success);
    assert.ok(result.data.every((l) => l.action === 'LIST_USERS'));
  });

  it('should export logs as JSON', () => {
    await_import_users.listUsers('admin');
    const result = await_import_audit.exportLogs('admin', ['json']);
    assert.ok(result.success);
    assert.ok(result.data.fileName.endsWith('.json'));
    // Verify file exists
    assert.ok(fs.existsSync(result.data.filePath));
  });

  it('should export logs as CSV', () => {
    await_import_users.listUsers('admin');
    const result = await_import_audit.exportLogs('admin', ['csv']);
    assert.ok(result.success);
    assert.ok(result.data.fileName.endsWith('.csv'));
  });

  it('should export logs as TXT', () => {
    await_import_users.listUsers('admin');
    const result = await_import_audit.exportLogs('admin', ['txt']);
    assert.ok(result.success);
    assert.ok(result.data.fileName.endsWith('.txt'));
  });

  it('should reject invalid export format', () => {
    const result = await_import_audit.exportLogs('admin', ['pdf']);
    assert.ok(!result.success);
    assert.ok(result.message.includes('Invalid format'));
  });
});

// ─── FULL WORKFLOW ───────────────────────────────────────────────────────────

describe('Full Editorial Workflow', () => {
  beforeEach(() => { cleanData(); seedAdmin(); });

  it('should complete full draft → approve → publish → WP workflow', () => {
    // 1. Reporter submits draft
    const submit = await_import_content.submitDraft('reporter1', ['ARTICLE001', 'Breaking News', 'Full article content here', 'reporter1']);
    assert.ok(submit.success);

    // 2. Redaktur edits draft
    const edit = await_import_content.editDraft('redaktur1', ['ARTICLE001', 'title=Breaking News: Updated']);
    assert.ok(edit.success);

    // 3. Pemred approves draft
    const approve = await_import_content.approveDraft('pemred1', ['ARTICLE001']);
    assert.ok(approve.success);

    // 4. Pemred publishes to social media
    const social = await_import_social.publishSocial('pemred1', ['ARTICLE001', 'twitter,facebook,instagram']);
    assert.ok(social.success);

    // 5. Admin uploads to WordPress
    const wp = await_import_wordpress.uploadWp('admin', ['ARTICLE001']);
    assert.ok(wp.success);

    // 6. Admin sets WP status to publish
    const wpStatus = await_import_wordpress.updateWpStatus('admin', ['ARTICLE001', 'publish']);
    assert.ok(wpStatus.success);

    // 7. Reporter checks social status
    const status = await_import_social.checkStatus('reporter1', ['ARTICLE001']);
    assert.ok(status.success);
    assert.equal(status.data.length, 3);

    // 8. Verify audit trail
    const logs = await_import_audit.listLogs('admin', []);
    assert.ok(logs.success);
    assert.ok(logs.data.length >= 6);
  });
});

// Cleanup after all tests
after(() => {
  cleanData();
  if (fs.existsSync(EXPORT_DIR)) {
    for (const file of fs.readdirSync(EXPORT_DIR)) {
      fs.unlinkSync(path.join(EXPORT_DIR, file));
    }
  }
});
