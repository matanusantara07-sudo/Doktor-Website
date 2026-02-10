import { runQuery, getQuery, allQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import { sendTestAlert } from '../integrations/notification-api.js';

const VALID_ALERT_TYPES = ['email', 'webhook', 'sms'];

export async function enableAlert(type, recipient, executedBy = 'system') {
  try {
    if (!VALID_ALERT_TYPES.includes(type)) {
      throw new Error(`Invalid alert type. Must be one of: ${VALID_ALERT_TYPES.join(', ')}`);
    }

    const existing = await getQuery(
      'SELECT id FROM alerts WHERE type = ? AND recipient = ?',
      [type, recipient]
    );

    if (existing) {
      await runQuery(
        'UPDATE alerts SET enabled = 1 WHERE id = ?',
        [existing.id]
      );
    } else {
      await runQuery(
        'INSERT INTO alerts (type, recipient, enabled) VALUES (?, ?, 1)',
        [type, recipient]
      );
    }

    await logAudit(executedBy, 'alerts', 'ENABLE_ALERT',
      `Enabled ${type} alert for ${recipient}`);

    return {
      success: true,
      type,
      recipient,
      message: 'Alert enabled successfully'
    };
  } catch (error) {
    await logAudit(executedBy, 'alerts', 'ENABLE_ALERT_FAILED',
      `Failed to enable alert: ${error.message}`);
    throw error;
  }
}

export async function disableAlert(type, recipient, executedBy = 'system') {
  try {
    if (!VALID_ALERT_TYPES.includes(type)) {
      throw new Error(`Invalid alert type. Must be one of: ${VALID_ALERT_TYPES.join(', ')}`);
    }

    const existing = await getQuery(
      'SELECT id FROM alerts WHERE type = ? AND recipient = ?',
      [type, recipient]
    );

    if (!existing) {
      throw new Error('Alert not found');
    }

    await runQuery(
      'UPDATE alerts SET enabled = 0 WHERE id = ?',
      [existing.id]
    );

    await logAudit(executedBy, 'alerts', 'DISABLE_ALERT',
      `Disabled ${type} alert for ${recipient}`);

    return {
      success: true,
      type,
      recipient,
      message: 'Alert disabled successfully'
    };
  } catch (error) {
    await logAudit(executedBy, 'alerts', 'DISABLE_ALERT_FAILED',
      `Failed to disable alert: ${error.message}`);
    throw error;
  }
}

export async function listAlerts(executedBy = 'system') {
  try {
    const alerts = await allQuery(
      'SELECT * FROM alerts ORDER BY created_at DESC'
    );

    await logAudit(executedBy, 'alerts', 'LIST_ALERTS',
      `Listed ${alerts.length} alerts`);

    return {
      success: true,
      count: alerts.length,
      alerts
    };
  } catch (error) {
    await logAudit(executedBy, 'alerts', 'LIST_ALERTS_FAILED',
      `Failed to list alerts: ${error.message}`);
    throw error;
  }
}

export async function testAlert(type, recipient, executedBy = 'system') {
  try {
    if (!VALID_ALERT_TYPES.includes(type)) {
      throw new Error(`Invalid alert type. Must be one of: ${VALID_ALERT_TYPES.join(', ')}`);
    }

    const testResult = await sendTestAlert(type, recipient);

    await logAudit(executedBy, 'alerts', 'TEST_ALERT',
      `Tested ${type} alert for ${recipient}: ${testResult.success ? 'Success' : 'Failed'}`);

    return {
      success: testResult.success,
      type,
      recipient,
      message: testResult.message
    };
  } catch (error) {
    await logAudit(executedBy, 'alerts', 'TEST_ALERT_FAILED',
      `Failed to test alert: ${error.message}`);
    throw error;
  }
}
