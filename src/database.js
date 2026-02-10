/**
 * Simple JSON file-based data store.
 * Each collection is stored as a separate JSON file in the data directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

function ensureDataDir() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

function collectionPath(name) {
  return path.join(config.dataDir, `${name}.json`);
}

const db = {
  /**
   * Read an entire collection. Returns an array or object (for settings).
   * @param {string} name - Collection name (e.g. 'users', 'drafts', 'settings')
   * @returns {Array|Object}
   */
  read(name) {
    ensureDataDir();
    const fp = collectionPath(name);
    // Settings is an object, not an array
    if (name === 'settings') {
      if (!fs.existsSync(fp)) return {};
      const raw = fs.readFileSync(fp, 'utf-8');
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    // All other collections are arrays
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, 'utf-8');
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  /**
   * Write an entire collection (replaces file contents).
   * @param {string} name
   * @param {Array|Object} data
   */
  write(name, data) {
    ensureDataDir();
    const fp = collectionPath(name);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
  },

  /**
   * Find a single record matching a predicate.
   * @param {string} name
   * @param {Function} predicate
   * @returns {Object|undefined}
   */
  findOne(name, predicate) {
    return this.read(name).find(predicate);
  },

  /**
   * Find all records matching a predicate.
   * @param {string} name
   * @param {Function} predicate
   * @returns {Array}
   */
  findMany(name, predicate) {
    return this.read(name).filter(predicate);
  },

  /**
   * Insert a record into a collection.
   * @param {string} name
   * @param {Object} record
   * @returns {Object} The inserted record
   */
  insert(name, record) {
    const data = this.read(name);
    record._createdAt = new Date().toISOString();
    record._updatedAt = record._createdAt;
    data.push(record);
    this.write(name, data);
    return record;
  },

  /**
   * Update records matching a predicate with new fields.
   * @param {string} name
   * @param {Function} predicate
   * @param {Object} updates
   * @returns {number} Count of updated records
   */
  update(name, predicate, updates) {
    const data = this.read(name);
    let count = 0;
    for (const record of data) {
      if (predicate(record)) {
        Object.assign(record, updates, { _updatedAt: new Date().toISOString() });
        count++;
      }
    }
    if (count > 0) this.write(name, data);
    return count;
  },

  /**
   * Remove records matching a predicate.
   * @param {string} name
   * @param {Function} predicate
   * @returns {number} Count of removed records
   */
  remove(name, predicate) {
    const data = this.read(name);
    const remaining = data.filter((r) => !predicate(r));
    const count = data.length - remaining.length;
    if (count > 0) this.write(name, remaining);
    return count;
  },
};

export default db;
