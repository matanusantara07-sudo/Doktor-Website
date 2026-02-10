/**
 * Audit Log Module
 *
 * Commands:
 *   LIST_LOGS <date_range>                — Admin_Teknis
 *   FILTER_LOGS <user|module|action>     — Admin_Teknis
 *   EXPORT_LOGS <format>                  — Admin_Teknis
 *
 * Also provides addAuditEntry() used by all other modules.
 */

import fs from 'node:fs';
import path from 'node:path';
import db from '../database.js';
import { authorize } from '../auth.js';
import config from '../config.js';
import logger from '../logger.js';

const MODULE = 'AUDIT';
const ALLOWED_ROLES = ['Admin_Teknis'];

/**
 * Add an audit log entry. Called by all modules after each command execution.
 * @param {string} username - Who performed the action
 * @param {string} action - Command name (e.g. 'CREATE_USER')
 * @param {string} module - Module name (e.g. 'USERS')
 * @param {Object} [details] - Additional context
 */
export function addAuditEntry(username, action, module, details) {
  db.insert('audit_logs', {
    username,
    action,
    module,
    details: details || {},
    timestamp: new Date().toISOString(),
  });
}

/**
 * LIST_LOGS [date_range]
 * date_range format: "YYYY-MM-DD" (single day) or "YYYY-MM-DD:YYYY-MM-DD" (range)
 */
export function listLogs(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [dateRange] = args;
  let logs = db.read('audit_logs');

  if (dateRange) {
    const parts = dateRange.split(':');
    const startDate = parts[0];
    const endDate = parts[1] || parts[0];

    logs = logs.filter((log) => {
      const logDate = (log.timestamp || log._createdAt || '').slice(0, 10);
      return logDate >= startDate && logDate <= endDate;
    });
  }

  const result = logs.map((l) => ({
    timestamp: l.timestamp,
    username: l.username,
    action: l.action,
    module: l.module,
    details: l.details,
  }));

  return {
    success: true,
    message: `Found ${result.length} audit log(s)${dateRange ? ` for range '${dateRange}'` : ''}.`,
    data: result,
  };
}

/**
 * FILTER_LOGS <filter_type>=<filter_value>
 * filter_type: user, module, action
 */
export function filterLogs(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [filterExpr] = args;
  if (!filterExpr) {
    return { success: false, message: 'Usage: FILTER_LOGS <user|module|action>=<value>' };
  }

  const eqIndex = filterExpr.indexOf('=');
  if (eqIndex === -1) {
    return { success: false, message: 'Invalid filter format. Use: user=<value>, module=<value>, or action=<value>.' };
  }

  const filterType = filterExpr.slice(0, eqIndex).toLowerCase();
  const filterValue = filterExpr.slice(eqIndex + 1);

  const validFilters = ['user', 'module', 'action'];
  if (!validFilters.includes(filterType)) {
    return { success: false, message: `Invalid filter type '${filterType}'. Valid: ${validFilters.join(', ')}` };
  }

  const fieldMap = { user: 'username', module: 'module', action: 'action' };
  const field = fieldMap[filterType];

  const logs = db.read('audit_logs');
  const filtered = logs.filter((l) => {
    const val = l[field] || '';
    return val.toLowerCase() === filterValue.toLowerCase();
  });

  const result = filtered.map((l) => ({
    timestamp: l.timestamp,
    username: l.username,
    action: l.action,
    module: l.module,
    details: l.details,
  }));

  return {
    success: true,
    message: `Found ${result.length} log(s) matching ${filterType}='${filterValue}'.`,
    data: result,
  };
}

/**
 * EXPORT_LOGS <format>
 * Supported formats: json, csv, txt
 */
export function exportLogs(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [format] = args;
  if (!format) {
    return { success: false, message: `Usage: EXPORT_LOGS <format>. Supported: ${config.exportFormats.join(', ')}` };
  }

  const fmt = format.toLowerCase();
  if (!config.exportFormats.includes(fmt)) {
    return { success: false, message: `Invalid format '${format}'. Supported: ${config.exportFormats.join(', ')}` };
  }

  const logs = db.read('audit_logs');
  if (logs.length === 0) {
    return { success: false, message: 'No audit logs to export.' };
  }

  // Ensure export directory
  if (!fs.existsSync(config.exportDir)) {
    fs.mkdirSync(config.exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `audit_logs_${timestamp}.${fmt}`;
  const filePath = path.join(config.exportDir, fileName);

  let content;
  if (fmt === 'json') {
    content = JSON.stringify(logs.map((l) => ({
      timestamp: l.timestamp,
      username: l.username,
      action: l.action,
      module: l.module,
      details: l.details,
    })), null, 2);
  } else if (fmt === 'csv') {
    const header = 'timestamp,username,action,module,details';
    const rows = logs.map((l) =>
      `"${l.timestamp}","${l.username}","${l.action}","${l.module}","${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`
    );
    content = [header, ...rows].join('\n');
  } else {
    // txt
    const lines = logs.map((l) =>
      `[${l.timestamp}] ${l.username} | ${l.action} | ${l.module} | ${JSON.stringify(l.details || {})}`
    );
    content = lines.join('\n');
  }

  fs.writeFileSync(filePath, content, 'utf-8');

  logger.info(MODULE, `Audit logs exported to '${fileName}' (${fmt}) by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'EXPORT_LOGS', MODULE, { format: fmt, fileName, recordCount: logs.length });

  return {
    success: true,
    message: `Audit logs exported to '${fileName}'. Records: ${logs.length}.`,
    data: { fileName, filePath, format: fmt, recordCount: logs.length },
  };
}

export default { addAuditEntry, listLogs, filterLogs, exportLogs };
