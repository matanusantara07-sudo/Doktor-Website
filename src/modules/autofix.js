/**
 * Auto-Fix Engine Module
 *
 * Commands:
 *   RESTART_SERVICE <service_name> <server_url>  — Admin_Teknis
 *   CLEAR_CACHE <server_url>                     — Admin_Teknis
 *   RECONNECT_API <api_url>                      — Admin_Teknis
 *   REFRESH_TOKEN <platform>                     — Admin_Teknis
 *   EXECUTE_FIX <fix_id>                         — Admin_Teknis
 *   LIST_FIXES                                   — Admin_Teknis
 */

import db from '../database.js';
import { authorize } from '../auth.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

const MODULE = 'AUTOFIX';
const ALLOWED_ROLES = ['Admin_Teknis'];

function createFixRecord(type, target, details, callerUsername) {
  const fixId = `fix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const record = db.insert('fixes', {
    fixId,
    type,
    target,
    details,
    status: 'completed',
    executedBy: callerUsername,
    executedAt: new Date().toISOString(),
  });
  return record;
}

/**
 * RESTART_SERVICE <service_name> <server_url>
 */
export function restartService(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [serviceName, serverUrl] = args;
  if (!serviceName || !serverUrl) {
    return { success: false, message: 'Usage: RESTART_SERVICE <service_name> <server_url>' };
  }

  // Simulate restart
  const fix = createFixRecord('restart_service', `${serviceName}@${serverUrl}`, {
    serviceName,
    serverUrl,
    downtime: '2s',
    previousUptime: '48h',
  }, callerUsername);

  // Update service status
  db.update(
    'services',
    (s) => s.serviceName === serviceName && s.serverUrl === serverUrl,
    { status: 'running', uptimeHours: 0, checkedAt: new Date().toISOString() }
  );

  logger.info(MODULE, `Service '${serviceName}' on '${serverUrl}' restarted by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'RESTART_SERVICE', MODULE, { serviceName, serverUrl, fixId: fix.fixId });

  return {
    success: true,
    message: `Service '${serviceName}' on '${serverUrl}' restarted successfully. Fix ID: ${fix.fixId}.`,
    data: { fixId: fix.fixId, serviceName, serverUrl, status: 'restarted' },
  };
}

/**
 * CLEAR_CACHE <server_url>
 */
export function clearCache(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [serverUrl] = args;
  if (!serverUrl) {
    return { success: false, message: 'Usage: CLEAR_CACHE <server_url>' };
  }

  const clearedMb = Math.floor(Math.random() * 500) + 50;
  const fix = createFixRecord('clear_cache', serverUrl, {
    serverUrl,
    clearedMb,
    cacheTypes: ['page', 'object', 'opcode'],
  }, callerUsername);

  logger.info(MODULE, `Cache cleared on '${serverUrl}' (${clearedMb}MB) by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'CLEAR_CACHE', MODULE, { serverUrl, clearedMb, fixId: fix.fixId });

  return {
    success: true,
    message: `Cache cleared on '${serverUrl}'. Freed: ${clearedMb}MB. Fix ID: ${fix.fixId}.`,
    data: { fixId: fix.fixId, serverUrl, clearedMb },
  };
}

/**
 * RECONNECT_API <api_url>
 */
export function reconnectApi(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [apiUrl] = args;
  if (!apiUrl) {
    return { success: false, message: 'Usage: RECONNECT_API <api_url>' };
  }

  const fix = createFixRecord('reconnect_api', apiUrl, {
    apiUrl,
    previousStatus: 'disconnected',
    newStatus: 'connected',
    reconnectTimeMs: Math.floor(Math.random() * 500) + 100,
  }, callerUsername);

  // Update API status
  db.update('apis', (a) => a.apiUrl === apiUrl, {
    status: 'healthy',
    checkedAt: new Date().toISOString(),
  });

  logger.info(MODULE, `API '${apiUrl}' reconnected by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'RECONNECT_API', MODULE, { apiUrl, fixId: fix.fixId });

  return {
    success: true,
    message: `API '${apiUrl}' reconnected successfully. Fix ID: ${fix.fixId}.`,
    data: { fixId: fix.fixId, apiUrl, status: 'connected' },
  };
}

/**
 * REFRESH_TOKEN <platform>
 */
export function refreshToken(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [platform] = args;
  if (!platform) {
    return { success: false, message: 'Usage: REFRESH_TOKEN <platform>' };
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  const fix = createFixRecord('refresh_token', platform, {
    platform,
    tokenRefreshed: true,
    expiresAt,
  }, callerUsername);

  logger.info(MODULE, `Token refreshed for '${platform}' by '${callerUsername}'. Expires: ${expiresAt}.`);
  addAuditEntry(callerUsername, 'REFRESH_TOKEN', MODULE, { platform, expiresAt, fixId: fix.fixId });

  return {
    success: true,
    message: `Token for '${platform}' refreshed. Expires: ${expiresAt}. Fix ID: ${fix.fixId}.`,
    data: { fixId: fix.fixId, platform, expiresAt },
  };
}

/**
 * EXECUTE_FIX <fix_id>
 */
export function executeFix(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [fixId] = args;
  if (!fixId) {
    return { success: false, message: 'Usage: EXECUTE_FIX <fix_id>' };
  }

  const fix = db.findOne('fixes', (f) => f.fixId === fixId);
  if (!fix) {
    return { success: false, message: `Fix '${fixId}' not found.` };
  }

  if (fix.status === 'completed') {
    return { success: false, message: `Fix '${fixId}' has already been executed.` };
  }

  db.update('fixes', (f) => f.fixId === fixId, {
    status: 'completed',
    executedBy: callerUsername,
    executedAt: new Date().toISOString(),
  });

  logger.info(MODULE, `Fix '${fixId}' executed by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'EXECUTE_FIX', MODULE, { fixId });

  return {
    success: true,
    message: `Fix '${fixId}' executed successfully.`,
    data: { fixId, status: 'completed' },
  };
}

/**
 * LIST_FIXES
 */
export function listFixes(callerUsername) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const fixes = db.read('fixes').map((f) => ({
    fixId: f.fixId,
    type: f.type,
    target: f.target,
    status: f.status,
    executedBy: f.executedBy,
    executedAt: f.executedAt,
  }));

  addAuditEntry(callerUsername, 'LIST_FIXES', MODULE, { count: fixes.length });

  return {
    success: true,
    message: `Found ${fixes.length} fix record(s).`,
    data: fixes,
  };
}

export default { restartService, clearCache, reconnectApi, refreshToken, executeFix, listFixes };
