import { runQuery, getQuery, allQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import {
  restartServiceAction,
  clearCacheAction,
  reconnectAPIAction,
  refreshTokenAction
} from '../integrations/auto-fix-api.js';

const VALID_FIX_TYPES = ['restart_service', 'clear_cache', 'reconnect_api', 'refresh_token'];

export async function restartService(serviceName, serverUrl, executedBy = 'system') {
  try {
    const result = await restartServiceAction(serviceName, serverUrl);

    // Log the fix
    await runQuery(
      'INSERT INTO auto_fixes (name, description, fix_type, target, status, last_executed) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [
        `Restart ${serviceName}`,
        `Restarted service ${serviceName} on ${serverUrl}`,
        'restart_service',
        `${serviceName}@${serverUrl}`,
        result.success ? 'completed' : 'failed'
      ]
    );

    await logAudit(executedBy, 'auto_fix', 'RESTART_SERVICE',
      `Restarted service ${serviceName} on ${serverUrl}: ${result.success ? 'Success' : 'Failed'}`);

    return {
      success: result.success,
      serviceName,
      serverUrl,
      message: result.message
    };
  } catch (error) {
    await logAudit(executedBy, 'auto_fix', 'RESTART_SERVICE_FAILED',
      `Failed to restart service ${serviceName} on ${serverUrl}: ${error.message}`);
    throw error;
  }
}

export async function clearCache(serverUrl, executedBy = 'system') {
  try {
    const result = await clearCacheAction(serverUrl);

    await runQuery(
      'INSERT INTO auto_fixes (name, description, fix_type, target, status, last_executed) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [
        `Clear cache on ${serverUrl}`,
        `Cleared cache on server ${serverUrl}`,
        'clear_cache',
        serverUrl,
        result.success ? 'completed' : 'failed'
      ]
    );

    await logAudit(executedBy, 'auto_fix', 'CLEAR_CACHE',
      `Cleared cache on ${serverUrl}: ${result.success ? 'Success' : 'Failed'}`);

    return {
      success: result.success,
      serverUrl,
      message: result.message
    };
  } catch (error) {
    await logAudit(executedBy, 'auto_fix', 'CLEAR_CACHE_FAILED',
      `Failed to clear cache on ${serverUrl}: ${error.message}`);
    throw error;
  }
}

export async function reconnectAPI(apiUrl, executedBy = 'system') {
  try {
    const result = await reconnectAPIAction(apiUrl);

    await runQuery(
      'INSERT INTO auto_fixes (name, description, fix_type, target, status, last_executed) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [
        `Reconnect API ${apiUrl}`,
        `Reconnected to API ${apiUrl}`,
        'reconnect_api',
        apiUrl,
        result.success ? 'completed' : 'failed'
      ]
    );

    await logAudit(executedBy, 'auto_fix', 'RECONNECT_API',
      `Reconnected to API ${apiUrl}: ${result.success ? 'Success' : 'Failed'}`);

    return {
      success: result.success,
      apiUrl,
      message: result.message
    };
  } catch (error) {
    await logAudit(executedBy, 'auto_fix', 'RECONNECT_API_FAILED',
      `Failed to reconnect to API ${apiUrl}: ${error.message}`);
    throw error;
  }
}

export async function refreshToken(platform, executedBy = 'system') {
  try {
    const result = await refreshTokenAction(platform);

    await runQuery(
      'INSERT INTO auto_fixes (name, description, fix_type, target, status, last_executed) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [
        `Refresh token for ${platform}`,
        `Refreshed authentication token for ${platform}`,
        'refresh_token',
        platform,
        result.success ? 'completed' : 'failed'
      ]
    );

    await logAudit(executedBy, 'auto_fix', 'REFRESH_TOKEN',
      `Refreshed token for ${platform}: ${result.success ? 'Success' : 'Failed'}`);

    return {
      success: result.success,
      platform,
      message: result.message
    };
  } catch (error) {
    await logAudit(executedBy, 'auto_fix', 'REFRESH_TOKEN_FAILED',
      `Failed to refresh token for ${platform}: ${error.message}`);
    throw error;
  }
}

export async function executeFix(fixId, executedBy = 'system') {
  try {
    const fix = await getQuery('SELECT * FROM auto_fixes WHERE id = ?', [fixId]);
    if (!fix) {
      throw new Error('Fix not found');
    }

    let result;
    switch (fix.fix_type) {
      case 'restart_service': {
        const [serviceName, serverUrl] = fix.target.split('@');
        result = await restartServiceAction(serviceName, serverUrl);
        break;
      }
      case 'clear_cache':
        result = await clearCacheAction(fix.target);
        break;
      case 'reconnect_api':
        result = await reconnectAPIAction(fix.target);
        break;
      case 'refresh_token':
        result = await refreshTokenAction(fix.target);
        break;
      default:
        throw new Error(`Unknown fix type: ${fix.fix_type}`);
    }

    await runQuery(
      'UPDATE auto_fixes SET status = ?, last_executed = CURRENT_TIMESTAMP WHERE id = ?',
      [result.success ? 'completed' : 'failed', fixId]
    );

    await logAudit(executedBy, 'auto_fix', 'EXECUTE_FIX',
      `Executed fix ${fixId} (${fix.name}): ${result.success ? 'Success' : 'Failed'}`);

    return {
      success: result.success,
      fixId,
      fixName: fix.name,
      message: result.message
    };
  } catch (error) {
    await logAudit(executedBy, 'auto_fix', 'EXECUTE_FIX_FAILED',
      `Failed to execute fix ${fixId}: ${error.message}`);
    throw error;
  }
}

export async function listFixes(executedBy = 'system') {
  try {
    const fixes = await allQuery(
      'SELECT * FROM auto_fixes ORDER BY last_executed DESC'
    );

    await logAudit(executedBy, 'auto_fix', 'LIST_FIXES',
      `Listed ${fixes.length} auto-fixes`);

    return {
      success: true,
      count: fixes.length,
      fixes
    };
  } catch (error) {
    await logAudit(executedBy, 'auto_fix', 'LIST_FIXES_FAILED',
      `Failed to list fixes: ${error.message}`);
    throw error;
  }
}
