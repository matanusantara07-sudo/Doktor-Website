/**
 * Emergency Module (SOMO - Sistem Operasi Mode Otomatis)
 * Handles emergency operations, mode switching, and backup
 * Role: Admin_Teknis only
 */

import db from '../database.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

/**
 * Set system operation mode
 * @param {string} username - User setting the mode
 * @param {string} mode - OBSERVE_ONLY or SEMI_AUTOMATION
 * @returns {object} Result
 */
export function setMode(username, mode) {
  const validModes = ['OBSERVE_ONLY', 'SEMI_AUTOMATION'];
  
  if (!validModes.includes(mode)) {
    return {
      success: false,
      error: `Invalid mode. Valid modes: ${validModes.join(', ')}`
    };
  }

  const previousMode = config.emergencyMode || 'SEMI_AUTOMATION';
  config.emergencyMode = mode;

  // Update database config
  const data = db.read();
  if (!data.system) data.system = {};
  data.system.emergencyMode = mode;
  data.system.modeChangedAt = new Date().toISOString();
  data.system.modeChangedBy = username;
  db.write(data);

  log('info', 'Emergency', `Mode changed from ${previousMode} to ${mode}`);

  return {
    success: true,
    message: `System mode changed to ${mode}`,
    previousMode,
    currentMode: mode,
    description: mode === 'OBSERVE_ONLY' 
      ? 'Auto-fix disabled. Only monitoring and alerts active.'
      : 'Semi-automation enabled. Manual approval required for critical fixes.',
    timestamp: data.system.modeChangedAt
  };
}

/**
 * Get current system mode
 * @returns {object} Current mode info
 */
export function getMode() {
  const data = db.read();
  const mode = data.system?.emergencyMode || config.emergencyMode || 'SEMI_AUTOMATION';
  
  return {
    success: true,
    currentMode: mode,
    modeChangedAt: data.system?.modeChangedAt || null,
    modeChangedBy: data.system?.modeChangedBy || null,
    description: mode === 'OBSERVE_ONLY'
      ? 'Auto-fix disabled. Only monitoring and alerts active.'
      : 'Semi-automation enabled. Manual approval required for critical fixes.'
  };
}

/**
 * Backup content/drafts
 * @param {string} username - User initiating backup
 * @param {Array} args - Command arguments [draftIdList]
 * @returns {object} Backup result
 */
export function backupContent(username, args) {
  const draftIdList = args[0] || 'all';
  const data = db.read();
  
  let draftsToBackup = [];
  
  if (draftIdList.toLowerCase() === 'all') {
    draftsToBackup = data.drafts || [];
  } else {
    const ids = draftIdList.split(',').map(id => id.trim());
    draftsToBackup = (data.drafts || []).filter(d => ids.includes(d.id));
    
    if (draftsToBackup.length === 0) {
      return {
        success: false,
        error: 'No drafts found with the specified IDs'
      };
    }
  }

  // Create backup
  const backupId = `BACKUP_${Date.now()}`;
  const backup = {
    id: backupId,
    timestamp: new Date().toISOString(),
    draftCount: draftsToBackup.length,
    drafts: draftsToBackup,
    metadata: {
      totalDrafts: data.drafts?.length || 0,
      backupType: draftIdList.toLowerCase() === 'all' ? 'FULL' : 'PARTIAL'
    }
  };

  // Store backup
  if (!data.backups) data.backups = [];
  data.backups.push(backup);
  db.write(data);

  log('info', 'Emergency', `Content backup created: ${backupId} (${draftsToBackup.length} drafts)`);

  return {
    success: true,
    message: 'Content backup created successfully',
    backupId,
    draftCount: draftsToBackup.length,
    timestamp: backup.timestamp,
    backupType: backup.metadata.backupType,
    drafts: draftsToBackup.map(d => ({
      id: d.id,
      title: d.title,
      status: d.status,
      author: d.author
    }))
  };
}

/**
 * List all backups
 * @returns {object} List of backups
 */
export function listBackups() {
  const data = db.read();
  const backups = data.backups || [];

  return {
    success: true,
    count: backups.length,
    backups: backups.map(b => ({
      id: b.id,
      timestamp: b.timestamp,
      draftCount: b.draftCount,
      backupType: b.metadata.backupType
    }))
  };
}

/**
 * Restore from backup
 * @param {string} username - User initiating restore
 * @param {string} backupId - Backup ID to restore
 * @returns {object} Restore result
 */
export function restoreBackup(username, backupId) {
  const data = db.read();
  const backup = (data.backups || []).find(b => b.id === backupId);

  if (!backup) {
    return {
      success: false,
      error: `Backup not found: ${backupId}`
    };
  }

  // Restore drafts
  const restoredCount = backup.drafts.length;
  
  // Merge with existing drafts (avoid duplicates)
  const existingIds = new Set((data.drafts || []).map(d => d.id));
  const newDrafts = backup.drafts.filter(d => !existingIds.has(d.id));
  
  if (!data.drafts) data.drafts = [];
  data.drafts.push(...newDrafts);
  
  db.write(data);

  log('info', 'Emergency', `Backup restored: ${backupId} (${newDrafts.length} new drafts)`);

  return {
    success: true,
    message: 'Backup restored successfully',
    backupId,
    totalDraftsInBackup: restoredCount,
    newDraftsRestored: newDrafts.length,
    skippedDuplicates: restoredCount - newDrafts.length
  };
}

/**
 * Emergency system health check
 * Runs comprehensive checks across all systems
 * @returns {object} Health check results
 */
export function emergencyHealthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    mode: getMode().currentMode,
    checks: {}
  };

  // Check WordPress connection
  try {
    const wpCheck = wordpress.checkConnection();
    results.checks.wordpress = {
      status: wpCheck.success ? 'OK' : 'ERROR',
      connected: wpCheck.connected,
      message: wpCheck.message
    };
  } catch (err) {
    results.checks.wordpress = { status: 'ERROR', error: err.message };
  }

  // Check servers
  try {
    const servers = monitoring.listServers();
    results.checks.servers = {
      status: 'OK',
      count: servers.servers?.length || 0
    };
  } catch (err) {
    results.checks.servers = { status: 'ERROR', error: err.message };
  }

  // Check services
  try {
    const services = monitoring.listServices();
    results.checks.services = {
      status: 'OK',
      count: services.services?.length || 0
    };
  } catch (err) {
    results.checks.services = { status: 'ERROR', error: err.message };
  }

  // Check available fixes
  try {
    const fixes = autofix.listFixes();
    results.checks.autofixes = {
      status: 'OK',
      available: fixes.fixes?.length || 0
    };
  } catch (err) {
    results.checks.autofixes = { status: 'ERROR', error: err.message };
  }

  // Overall status
  const hasErrors = Object.values(results.checks).some(c => c.status === 'ERROR');
  results.overallStatus = hasErrors ? 'DEGRADED' : 'HEALTHY';

  log('info', 'Emergency', `Health check completed: ${results.overallStatus}`);

  return {
    success: true,
    ...results
  };
}

/**
 * Emergency rollback - revert recent changes
 * @param {number} minutes - Rollback changes from last N minutes
 * @returns {object} Rollback result
 */
export function emergencyRollback(minutes = 30) {
  const data = db.read();
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  // Find recent changes in audit log
  const recentChanges = (data.auditLogs || []).filter(log => 
    log.timestamp >= cutoffTime && 
    ['APPROVE_DRAFT', 'PUBLISH_SOCIAL', 'UPLOAD_WP'].includes(log.action)
  );

  if (recentChanges.length === 0) {
    return {
      success: true,
      message: `No changes found in the last ${minutes} minutes`,
      rolledBack: 0
    };
  }

  let rolledBack = 0;

  // Rollback draft approvals
  recentChanges.forEach(change => {
    if (change.action === 'APPROVE_DRAFT') {
      const draft = (data.drafts || []).find(d => d.id === change.details?.draftId);
      if (draft && draft.status === 'approved') {
        draft.status = 'pending';
        draft.approvedBy = null;
        draft.approvedAt = null;
        rolledBack++;
      }
    }
  });

  db.write(data);

  log('warn', 'Emergency', `Emergency rollback executed: ${rolledBack} changes reverted (${minutes} min window)`);

  return {
    success: true,
    message: `Emergency rollback completed`,
    timeWindow: `${minutes} minutes`,
    changesFound: recentChanges.length,
    rolledBack,
    affectedActions: [...new Set(recentChanges.map(c => c.action))]
  };
}

/**
 * Get comprehensive system status
 * @param {string} username - User requesting status
 * @returns {object} System status
 */
export function systemStatus(username) {
  const data = db.read();
  const mode = getMode();
  
  return {
    success: true,
    timestamp: new Date().toISOString(),
    mode: mode.currentMode,
    modeChangedAt: mode.modeChangedAt,
    statistics: {
      totalUsers: (data.users || []).length,
      totalDrafts: (data.drafts || []).length,
      totalBackups: (data.backups || []).length,
      totalAuditLogs: (data.auditLogs || []).length,
      draftsByStatus: (data.drafts || []).reduce((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      }, {})
    },
    health: emergencyHealthCheck()
  };
}

/**
 * Emergency shutdown - disable all automation
 * @param {string} username - User initiating shutdown
 * @returns {object} Shutdown result
 */
export function emergencyShutdown(username) {
  const result = setMode('OBSERVE_ONLY');
  
  if (result.success) {
    const data = db.read();
    if (!data.system) data.system = {};
    data.system.emergencyShutdown = true;
    data.system.shutdownAt = new Date().toISOString();
    data.system.shutdownBy = username;
    db.write(data);

    log('critical', 'Emergency', `EMERGENCY SHUTDOWN initiated by ${username}`);

    return {
      success: true,
      message: 'EMERGENCY SHUTDOWN ACTIVATED',
      mode: 'OBSERVE_ONLY',
      automation: 'DISABLED',
      monitoring: 'ACTIVE',
      alerts: 'ACTIVE',
      shutdownAt: data.system.shutdownAt,
      shutdownBy: username,
      note: 'All automation disabled. Use RESUME_OPERATIONS to restore.'
    };
  }

  return result;
}

/**
 * Resume normal operations after emergency shutdown
 * @param {string} username - User resuming operations
 * @returns {object} Resume result
 */
export function resumeOperations(username) {
  const data = db.read();
  
  if (!data.system?.emergencyShutdown) {
    return {
      success: false,
      error: 'No emergency shutdown is active'
    };
  }

  const result = setMode('SEMI_AUTOMATION');
  
  if (result.success) {
    data.system.emergencyShutdown = false;
    data.system.resumedAt = new Date().toISOString();
    data.system.resumedBy = username;
    db.write(data);

    log('info', 'Emergency', `Operations resumed by ${username}`);

    return {
      success: true,
      message: 'Operations resumed successfully',
      mode: 'SEMI_AUTOMATION',
      automation: 'ENABLED',
      resumedAt: data.system.resumedAt,
      resumedBy: username,
      previousShutdown: {
        shutdownAt: data.system.shutdownAt,
        shutdownBy: data.system.shutdownBy
      }
    };
  }

  return result;
}
