#!/usr/bin/env node

/**
 * Emergency/Darurat Module Tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Import modules
import db from '../src/database.js';
import config from '../src/config.js';
import * as emergency from '../src/modules/emergency.js';
import { hashPassword } from '../src/auth.js';

describe('Emergency Module', () => {
  const testUser = 'admin_test';

  before(() => {
    // Create test admin user
    const { hash, salt } = hashPassword('test123');
    db.insert('users', {
      username: testUser,
      email: 'admin@test.com',
      role: 'Admin_Teknis',
      passwordHash: hash,
      passwordSalt: salt,
      active: true,
    });

    // Initialize settings
    const settings = db.read('settings');
    settings.systemMode = 'full_automation';
    db.write('settings', settings);
  });

  after(() => {
    // Cleanup test data
    const dataFiles = fs.readdirSync(config.dataDir);
    for (const file of dataFiles) {
      fs.unlinkSync(path.join(config.dataDir, file));
    }
  });

  describe('SET_MODE', () => {
    it('should set system mode to observe_only', () => {
      const result = emergency.setMode(testUser, 'observe_only');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.newMode, 'observe_only');
      
      const settings = db.read('settings');
      assert.strictEqual(settings.systemMode, 'observe_only');
    });

    it('should set system mode to semi_automation', () => {
      const result = emergency.setMode(testUser, 'semi_automation');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.newMode, 'semi_automation');
    });

    it('should set system mode to full_automation', () => {
      const result = emergency.setMode(testUser, 'full_automation');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.newMode, 'full_automation');
    });

    it('should reject invalid mode', () => {
      const result = emergency.setMode(testUser, 'invalid_mode');
      assert.strictEqual(result.success, false);
      assert.match(result.message, /Invalid mode/);
    });
  });

  describe('BACKUP_CONTENT', () => {
    before(() => {
      // Create test drafts
      db.insert('drafts', {
        id: 'draft-backup-1',
        title: 'Test Draft 1',
        content: 'Content 1',
        author: 'reporter1',
        status: 'approved',
      });
      db.insert('drafts', {
        id: 'draft-backup-2',
        title: 'Test Draft 2',
        content: 'Content 2',
        author: 'reporter1',
        status: 'draft',
      });
    });

    it('should backup specified drafts', () => {
      const result = emergency.backupContent(testUser, ['draft-backup-1', 'draft-backup-2']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.backedUp, 2);
      assert.match(result.data.backupId, /^backup-/);

      const backups = db.read('backups');
      assert.strictEqual(backups.length, 1);
      assert.strictEqual(backups[0].count, 2);
      assert.strictEqual(backups[0].createdBy, testUser);
    });

    it('should handle non-existent drafts', () => {
      const result = emergency.backupContent(testUser, ['draft-nonexistent']);
      assert.strictEqual(result.success, false);
      assert.match(result.message, /No drafts found/);
    });

    it('should backup only existing drafts and report missing ones', () => {
      const result = emergency.backupContent(testUser, ['draft-backup-1', 'draft-missing']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.backedUp, 1);
      assert.ok(result.data.notFound);
    });
  });

  describe('LIST_BACKUPS', () => {
    it('should list all backups', () => {
      const result = emergency.listBackups();
      assert.strictEqual(result.success, true);
      assert.ok(result.data.length >= 1);
      assert.ok(result.data[0].id);
      assert.ok(result.data[0].timestamp);
      assert.strictEqual(result.data[0].createdBy, testUser);
    });
  });

  describe('RESTORE_BACKUP', () => {
    it('should restore drafts from backup', () => {
      // First, get a backup ID
      const backups = db.read('backups');
      const backupId = backups[0].id;

      // Delete one of the drafts
      db.remove('drafts', d => d.id === 'draft-backup-1');

      // Restore
      const result = emergency.restoreBackup(testUser, backupId);
      assert.strictEqual(result.success, true);
      assert.ok(result.data.restored >= 1);

      // Verify draft is restored
      const draft = db.findOne('drafts', d => d.id === 'draft-backup-1');
      assert.ok(draft);
    });

    it('should handle non-existent backup', () => {
      const result = emergency.restoreBackup(testUser, 'backup-nonexistent');
      assert.strictEqual(result.success, false);
      assert.match(result.message, /Backup not found/);
    });
  });

  describe('SYSTEM_STATUS', () => {
    before(() => {
      // Create test servers and services
      db.insert('servers', {
        url: 'https://test-server.com',
        status: 'online',
        lastCheck: new Date().toISOString(),
      });
      db.insert('services', {
        name: 'test-service',
        status: 'running',
        lastCheck: new Date().toISOString(),
      });
      db.insert('alerts', {
        type: 'email',
        recipient: 'admin@test.com',
        enabled: true,
      });
      db.insert('fixes', {
        id: 'fix-1',
        status: 'pending',
        action: 'restart',
      });
    });

    it('should return comprehensive system status', () => {
      const result = emergency.systemStatus(testUser);
      assert.strictEqual(result.success, true);
      assert.ok(result.data.mode);
      assert.ok(result.data.servers);
      assert.ok(result.data.services);
      assert.ok(result.data.alerts);
      assert.ok(result.data.fixes);
      assert.strictEqual(result.data.servers.total, 1);
      assert.strictEqual(result.data.services.total, 1);
      assert.strictEqual(result.data.alerts.active, 1);
      assert.strictEqual(result.data.fixes.pending, 1);
    });
  });

  describe('EMERGENCY_SHUTDOWN', () => {
    it('should activate emergency shutdown', () => {
      const result = emergency.emergencyShutdown(testUser);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.mode, 'observe_only');

      const settings = db.read('settings');
      assert.strictEqual(settings.systemMode, 'observe_only');
      assert.strictEqual(settings.emergencyShutdown, true);
      assert.strictEqual(settings.shutdownBy, testUser);
      assert.ok(settings.shutdownAt);
    });
  });

  describe('RESUME_OPERATIONS', () => {
    it('should resume normal operations', () => {
      const result = emergency.resumeOperations(testUser);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.mode, 'full_automation');

      const settings = db.read('settings');
      assert.strictEqual(settings.systemMode, 'full_automation');
      assert.strictEqual(settings.emergencyShutdown, undefined);
      assert.strictEqual(settings.shutdownBy, undefined);
      assert.strictEqual(settings.shutdownAt, undefined);
    });
  });
});
