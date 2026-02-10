#!/usr/bin/env node

/**
 * Seed script — creates the default admin user and sample data.
 *
 * Usage: node src/seed.js
 */

import db from './database.js';
import { hashPassword } from './auth.js';
import config from './config.js';

function seed() {
  console.log('🌱 Seeding Doktor-Website database...\n');

  // Create default admin user
  const existingAdmin = db.findOne('users', (u) => u.username === 'admin');
  if (!existingAdmin) {
    const { hash, salt } = hashPassword(config.defaultPassword);
    db.insert('users', {
      username: 'admin',
      email: 'admin@doktor-website.id',
      role: 'Admin_Teknis',
      passwordHash: hash,
      passwordSalt: salt,
      active: true,
    });
    console.log('  ✓ Created user: admin (Admin_Teknis)');
  } else {
    console.log('  – User "admin" already exists, skipping.');
  }

  // Create sample reporter
  const existingReporter = db.findOne('users', (u) => u.username === 'reporter1');
  if (!existingReporter) {
    const { hash, salt } = hashPassword(config.defaultPassword);
    db.insert('users', {
      username: 'reporter1',
      email: 'reporter1@doktor-website.id',
      role: 'Reporter',
      passwordHash: hash,
      passwordSalt: salt,
      active: true,
    });
    console.log('  ✓ Created user: reporter1 (Reporter)');
  } else {
    console.log('  – User "reporter1" already exists, skipping.');
  }

  // Create sample redaktur
  const existingRedaktur = db.findOne('users', (u) => u.username === 'redaktur1');
  if (!existingRedaktur) {
    const { hash, salt } = hashPassword(config.defaultPassword);
    db.insert('users', {
      username: 'redaktur1',
      email: 'redaktur1@doktor-website.id',
      role: 'Redaktur',
      passwordHash: hash,
      passwordSalt: salt,
      active: true,
    });
    console.log('  ✓ Created user: redaktur1 (Redaktur)');
  } else {
    console.log('  – User "redaktur1" already exists, skipping.');
  }

  // Create sample pemred
  const existingPemred = db.findOne('users', (u) => u.username === 'pemred1');
  if (!existingPemred) {
    const { hash, salt } = hashPassword(config.defaultPassword);
    db.insert('users', {
      username: 'pemred1',
      email: 'pemred1@doktor-website.id',
      role: 'Pemred',
      passwordHash: hash,
      passwordSalt: salt,
      active: true,
    });
    console.log('  ✓ Created user: pemred1 (Pemred)');
  } else {
    console.log('  – User "pemred1" already exists, skipping.');
  }

  // Initialize backups collection if not exists
  const backups = db.read('backups');
  if (backups.length === 0) {
    console.log('  ✓ Initialized backups collection');
  }

  // Initialize settings with default system mode
  const settings = db.read('settings');
  if (!settings.systemMode) {
    settings.systemMode = 'full_automation';
    db.write('settings', settings);
    console.log('  ✓ Initialized system settings (mode: full_automation)');
  }

  console.log('\n✅ Seed complete. Default password for all users: "' + config.defaultPassword + '"');
  console.log('   Run: node src/index.js --user admin LIST_USERS\n');
}

seed();
