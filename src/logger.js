/**
 * Structured logging utility.
 * Writes to stdout and optionally to a log file.
 */

import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
let currentLevel = LOG_LEVELS.INFO;

function ensureLogsDir() {
  if (!fs.existsSync(config.logsDir)) {
    fs.mkdirSync(config.logsDir, { recursive: true });
  }
}

function formatEntry(level, module, message, data) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, module, message };
  if (data !== undefined) entry.data = data;
  return entry;
}

function writeToFile(entry) {
  ensureLogsDir();
  const date = entry.timestamp.slice(0, 10);
  const filePath = path.join(config.logsDir, `${date}.log`);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
}

function log(level, module, message, data) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const entry = formatEntry(level, module, message, data);
  const prefix = `[${entry.timestamp}] [${level}] [${module}]`;
  if (level === 'ERROR') {
    console.error(`${prefix} ${message}`);
  } else if (level === 'WARN') {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
  writeToFile(entry);
}

const logger = {
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) currentLevel = LOG_LEVELS[level];
  },
  debug(module, message, data) { log('DEBUG', module, message, data); },
  info(module, message, data) { log('INFO', module, message, data); },
  warn(module, message, data) { log('WARN', module, message, data); },
  error(module, message, data) { log('ERROR', module, message, data); },
};

export default logger;
