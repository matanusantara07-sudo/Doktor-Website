/**
 * Alert & Notification Module
 *
 * Commands:
 *   ENABLE_ALERT <type> <recipient>         — Admin_Teknis
 *   DISABLE_ALERT <type> <recipient>        — Admin_Teknis
 *   LIST_ALERTS                             — Admin_Teknis
 *   TEST_ALERT <type> <recipient>           — Admin_Teknis
 */

import db from '../database.js';
import { authorize } from '../auth.js';
import config from '../config.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

const MODULE = 'ALERTS';
const ALLOWED_ROLES = ['Admin_Teknis'];

function validateAlertType(type) {
  return config.alertTypes.includes(type.toLowerCase());
}

/**
 * ENABLE_ALERT <type> <recipient>
 */
export function enableAlert(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [type, recipient] = args;
  if (!type || !recipient) {
    return { success: false, message: 'Usage: ENABLE_ALERT <type> <recipient>' };
  }

  const alertType = type.toLowerCase();
  if (!validateAlertType(alertType)) {
    return { success: false, message: `Invalid alert type '${type}'. Supported: ${config.alertTypes.join(', ')}` };
  }

  const existing = db.findOne('alerts', (a) => a.type === alertType && a.recipient === recipient);
  if (existing && existing.enabled) {
    return { success: false, message: `Alert '${alertType}' for '${recipient}' is already enabled.` };
  }

  if (existing) {
    db.update('alerts', (a) => a.type === alertType && a.recipient === recipient, { enabled: true });
  } else {
    db.insert('alerts', {
      type: alertType,
      recipient,
      enabled: true,
      createdBy: callerUsername,
    });
  }

  logger.info(MODULE, `Alert '${alertType}' enabled for '${recipient}' by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'ENABLE_ALERT', MODULE, { type: alertType, recipient });

  return {
    success: true,
    message: `Alert '${alertType}' enabled for '${recipient}'.`,
  };
}

/**
 * DISABLE_ALERT <type> <recipient>
 */
export function disableAlert(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [type, recipient] = args;
  if (!type || !recipient) {
    return { success: false, message: 'Usage: DISABLE_ALERT <type> <recipient>' };
  }

  const alertType = type.toLowerCase();
  if (!validateAlertType(alertType)) {
    return { success: false, message: `Invalid alert type '${type}'. Supported: ${config.alertTypes.join(', ')}` };
  }

  const existing = db.findOne('alerts', (a) => a.type === alertType && a.recipient === recipient);
  if (!existing) {
    return { success: false, message: `Alert '${alertType}' for '${recipient}' not found.` };
  }

  if (!existing.enabled) {
    return { success: false, message: `Alert '${alertType}' for '${recipient}' is already disabled.` };
  }

  db.update('alerts', (a) => a.type === alertType && a.recipient === recipient, { enabled: false });

  logger.info(MODULE, `Alert '${alertType}' disabled for '${recipient}' by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'DISABLE_ALERT', MODULE, { type: alertType, recipient });

  return {
    success: true,
    message: `Alert '${alertType}' disabled for '${recipient}'.`,
  };
}

/**
 * LIST_ALERTS
 */
export function listAlerts(callerUsername) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const alerts = db.read('alerts').map((a) => ({
    type: a.type,
    recipient: a.recipient,
    enabled: a.enabled,
    createdBy: a.createdBy,
    createdAt: a._createdAt,
  }));

  addAuditEntry(callerUsername, 'LIST_ALERTS', MODULE, { count: alerts.length });

  return {
    success: true,
    message: `Found ${alerts.length} alert(s).`,
    data: alerts,
  };
}

/**
 * TEST_ALERT <type> <recipient>
 */
export function testAlert(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [type, recipient] = args;
  if (!type || !recipient) {
    return { success: false, message: 'Usage: TEST_ALERT <type> <recipient>' };
  }

  const alertType = type.toLowerCase();
  if (!validateAlertType(alertType)) {
    return { success: false, message: `Invalid alert type '${type}'. Supported: ${config.alertTypes.join(', ')}` };
  }

  // Simulate sending a test alert
  const testResult = {
    type: alertType,
    recipient,
    testMessage: `[TEST] Doktor-Website alert test — ${alertType} to ${recipient}`,
    delivered: true,
    deliveredAt: new Date().toISOString(),
  };

  logger.info(MODULE, `Test alert '${alertType}' sent to '${recipient}' by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'TEST_ALERT', MODULE, testResult);

  return {
    success: true,
    message: `Test alert '${alertType}' sent to '${recipient}' successfully.`,
    data: testResult,
  };
}

export default { enableAlert, disableAlert, listAlerts, testAlert };
