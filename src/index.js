#!/usr/bin/env node

/**
 * Doktor-Website — Media Online Management System
 *
 * CLI Entry Point & Command Router
 *
 * Usage:
 *   node src/index.js --user <username> <COMMAND> [args...]
 *   node src/index.js --help
 */

import { parseArgs } from 'node:util';
import logger from './logger.js';

// Module imports
import { createUser, deleteUser, updateUserRole, resetPassword, listUsers } from './modules/users.js';
import { submitDraft, editDraft, approveDraft, rejectDraft, listDrafts } from './modules/content.js';
import { publishSocial, retryPublish, checkStatus } from './modules/social.js';
import { uploadWp, updateWpStatus, checkWpConnection } from './modules/wordpress.js';
import { pingServer, checkApi, checkService, listServers, listServices } from './modules/monitoring.js';
import { enableAlert, disableAlert, listAlerts, testAlert } from './modules/alerts.js';
import { restartService, clearCache, reconnectApi, refreshToken, executeFix, listFixes } from './modules/autofix.js';
import { checkAnalytics, checkAds, checkAdsense, listMetrics } from './modules/analytics.js';
import { listLogs, filterLogs, exportLogs } from './modules/audit.js';

/**
 * Command registry: maps command names to handler functions and metadata.
 * Each entry: { handler, description, usage, roles }
 */
const COMMANDS = {
  // User Management
  CREATE_USER: {
    handler: (user, args) => createUser(user, args),
    description: 'Create a new user',
    usage: 'CREATE_USER <username> <email> <role>',
    roles: ['Admin_Teknis'],
  },
  DELETE_USER: {
    handler: (user, args) => deleteUser(user, args),
    description: 'Delete a user',
    usage: 'DELETE_USER <username>',
    roles: ['Admin_Teknis'],
  },
  UPDATE_USER_ROLE: {
    handler: (user, args) => updateUserRole(user, args),
    description: 'Update a user\'s role',
    usage: 'UPDATE_USER_ROLE <username> <new_role>',
    roles: ['Admin_Teknis'],
  },
  RESET_PASSWORD: {
    handler: (user, args) => resetPassword(user, args),
    description: 'Reset a user\'s password to default',
    usage: 'RESET_PASSWORD <username>',
    roles: ['Admin_Teknis'],
  },
  LIST_USERS: {
    handler: (user) => listUsers(user),
    description: 'List all users',
    usage: 'LIST_USERS',
    roles: ['Admin_Teknis'],
  },

  // Content Management
  SUBMIT_DRAFT: {
    handler: (user, args) => submitDraft(user, args),
    description: 'Submit a new draft',
    usage: 'SUBMIT_DRAFT <draft_id> <title> <content> [author]',
    roles: ['Reporter', 'Redaktur', 'Pemred', 'Admin_Teknis'],
  },
  EDIT_DRAFT: {
    handler: (user, args) => editDraft(user, args),
    description: 'Edit a draft field',
    usage: 'EDIT_DRAFT <draft_id> <field>=<value>',
    roles: ['Reporter', 'Redaktur', 'Pemred', 'Admin_Teknis'],
  },
  APPROVE_DRAFT: {
    handler: (user, args) => approveDraft(user, args),
    description: 'Approve a draft',
    usage: 'APPROVE_DRAFT <draft_id>',
    roles: ['Redaktur', 'Pemred', 'Admin_Teknis'],
  },
  REJECT_DRAFT: {
    handler: (user, args) => rejectDraft(user, args),
    description: 'Reject a draft with reason',
    usage: 'REJECT_DRAFT <draft_id> <reason>',
    roles: ['Redaktur', 'Pemred', 'Admin_Teknis'],
  },
  LIST_DRAFTS: {
    handler: (user, args) => listDrafts(user, args),
    description: 'List drafts by status',
    usage: 'LIST_DRAFTS [status]',
    roles: ['Redaktur', 'Pemred', 'Admin_Teknis'],
  },

  // Social Media
  PUBLISH_SOCIAL: {
    handler: (user, args) => publishSocial(user, args),
    description: 'Publish draft to social media',
    usage: 'PUBLISH_SOCIAL <draft_id> <platform_list> [schedule_time]',
    roles: ['Pemred', 'Admin_Teknis'],
  },
  RETRY_PUBLISH: {
    handler: (user, args) => retryPublish(user, args),
    description: 'Retry failed social media publish',
    usage: 'RETRY_PUBLISH <draft_id> <platform_list>',
    roles: ['Pemred', 'Admin_Teknis'],
  },
  CHECK_STATUS: {
    handler: (user, args) => checkStatus(user, args),
    description: 'Check social media publish status',
    usage: 'CHECK_STATUS <draft_id> [platform]',
    roles: ['Reporter', 'Redaktur', 'Pemred', 'Admin_Teknis'],
  },

  // WordPress
  UPLOAD_WP: {
    handler: (user, args) => uploadWp(user, args),
    description: 'Upload draft to WordPress',
    usage: 'UPLOAD_WP <draft_id>',
    roles: ['Admin_Teknis'],
  },
  UPDATE_WP_STATUS: {
    handler: (user, args) => updateWpStatus(user, args),
    description: 'Update WordPress post status',
    usage: 'UPDATE_WP_STATUS <draft_id> <status>',
    roles: ['Admin_Teknis'],
  },
  CHECK_WP_CONNECTION: {
    handler: (user) => checkWpConnection(user),
    description: 'Check WordPress connection',
    usage: 'CHECK_WP_CONNECTION',
    roles: ['Admin_Teknis'],
  },

  // Monitoring
  PING_SERVER: {
    handler: (user, args) => pingServer(user, args),
    description: 'Ping a server',
    usage: 'PING_SERVER <server_url>',
    roles: ['Admin_Teknis'],
  },
  CHECK_API: {
    handler: (user, args) => checkApi(user, args),
    description: 'Check API health',
    usage: 'CHECK_API <api_url>',
    roles: ['Admin_Teknis'],
  },
  CHECK_SERVICE: {
    handler: (user, args) => checkService(user, args),
    description: 'Check service status',
    usage: 'CHECK_SERVICE <service_name> <server_url>',
    roles: ['Admin_Teknis'],
  },
  LIST_SERVERS: {
    handler: (user) => listServers(user),
    description: 'List monitored servers',
    usage: 'LIST_SERVERS',
    roles: ['Admin_Teknis'],
  },
  LIST_SERVICES: {
    handler: (user) => listServices(user),
    description: 'List monitored services',
    usage: 'LIST_SERVICES',
    roles: ['Admin_Teknis'],
  },

  // Alerts
  ENABLE_ALERT: {
    handler: (user, args) => enableAlert(user, args),
    description: 'Enable an alert',
    usage: 'ENABLE_ALERT <type> <recipient>',
    roles: ['Admin_Teknis'],
  },
  DISABLE_ALERT: {
    handler: (user, args) => disableAlert(user, args),
    description: 'Disable an alert',
    usage: 'DISABLE_ALERT <type> <recipient>',
    roles: ['Admin_Teknis'],
  },
  LIST_ALERTS: {
    handler: (user) => listAlerts(user),
    description: 'List all alerts',
    usage: 'LIST_ALERTS',
    roles: ['Admin_Teknis'],
  },
  TEST_ALERT: {
    handler: (user, args) => testAlert(user, args),
    description: 'Send a test alert',
    usage: 'TEST_ALERT <type> <recipient>',
    roles: ['Admin_Teknis'],
  },

  // Auto-Fix
  RESTART_SERVICE: {
    handler: (user, args) => restartService(user, args),
    description: 'Restart a service',
    usage: 'RESTART_SERVICE <service_name> <server_url>',
    roles: ['Admin_Teknis'],
  },
  CLEAR_CACHE: {
    handler: (user, args) => clearCache(user, args),
    description: 'Clear server cache',
    usage: 'CLEAR_CACHE <server_url>',
    roles: ['Admin_Teknis'],
  },
  RECONNECT_API: {
    handler: (user, args) => reconnectApi(user, args),
    description: 'Reconnect to an API',
    usage: 'RECONNECT_API <api_url>',
    roles: ['Admin_Teknis'],
  },
  REFRESH_TOKEN: {
    handler: (user, args) => refreshToken(user, args),
    description: 'Refresh platform token',
    usage: 'REFRESH_TOKEN <platform>',
    roles: ['Admin_Teknis'],
  },
  EXECUTE_FIX: {
    handler: (user, args) => executeFix(user, args),
    description: 'Execute a pending fix',
    usage: 'EXECUTE_FIX <fix_id>',
    roles: ['Admin_Teknis'],
  },
  LIST_FIXES: {
    handler: (user) => listFixes(user),
    description: 'List all fix records',
    usage: 'LIST_FIXES',
    roles: ['Admin_Teknis'],
  },

  // Analytics
  CHECK_ANALYTICS: {
    handler: (user, args) => checkAnalytics(user, args),
    description: 'Check analytics metric',
    usage: 'CHECK_ANALYTICS <metric> <platform>',
    roles: ['Admin_Teknis'],
  },
  CHECK_ADS: {
    handler: (user, args) => checkAds(user, args),
    description: 'Check ad campaign',
    usage: 'CHECK_ADS <campaign_id>',
    roles: ['Admin_Teknis'],
  },
  CHECK_ADSENSE: {
    handler: (user, args) => checkAdsense(user, args),
    description: 'Check AdSense stats',
    usage: 'CHECK_ADSENSE <site_id>',
    roles: ['Admin_Teknis'],
  },
  LIST_METRICS: {
    handler: (user) => listMetrics(user),
    description: 'List available metrics',
    usage: 'LIST_METRICS',
    roles: ['Admin_Teknis'],
  },

  // Audit
  LIST_LOGS: {
    handler: (user, args) => listLogs(user, args),
    description: 'List audit logs',
    usage: 'LIST_LOGS [date_range]',
    roles: ['Admin_Teknis'],
  },
  FILTER_LOGS: {
    handler: (user, args) => filterLogs(user, args),
    description: 'Filter audit logs',
    usage: 'FILTER_LOGS <user|module|action>=<value>',
    roles: ['Admin_Teknis'],
  },
  EXPORT_LOGS: {
    handler: (user, args) => exportLogs(user, args),
    description: 'Export audit logs',
    usage: 'EXPORT_LOGS <format>',
    roles: ['Admin_Teknis'],
  },
};

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              DOKTOR-WEBSITE — Management CLI                ║
║     Aplikasi Alat Service Website Media Online              ║
╚══════════════════════════════════════════════════════════════╝

Usage:
  node src/index.js --user <username> <COMMAND> [args...]
  node src/index.js --help

Options:
  --user, -u    Username of the caller (required for commands)
  --help, -h    Show this help message
  --json        Output result as JSON

Available Commands:
`);

  const categories = {
    'User Management': ['CREATE_USER', 'DELETE_USER', 'UPDATE_USER_ROLE', 'RESET_PASSWORD', 'LIST_USERS'],
    'Content Management': ['SUBMIT_DRAFT', 'EDIT_DRAFT', 'APPROVE_DRAFT', 'REJECT_DRAFT', 'LIST_DRAFTS'],
    'Social Media': ['PUBLISH_SOCIAL', 'RETRY_PUBLISH', 'CHECK_STATUS'],
    'WordPress': ['UPLOAD_WP', 'UPDATE_WP_STATUS', 'CHECK_WP_CONNECTION'],
    'Monitoring': ['PING_SERVER', 'CHECK_API', 'CHECK_SERVICE', 'LIST_SERVERS', 'LIST_SERVICES'],
    'Alerts': ['ENABLE_ALERT', 'DISABLE_ALERT', 'LIST_ALERTS', 'TEST_ALERT'],
    'Auto-Fix': ['RESTART_SERVICE', 'CLEAR_CACHE', 'RECONNECT_API', 'REFRESH_TOKEN', 'EXECUTE_FIX', 'LIST_FIXES'],
    'Analytics': ['CHECK_ANALYTICS', 'CHECK_ADS', 'CHECK_ADSENSE', 'LIST_METRICS'],
    'Audit': ['LIST_LOGS', 'FILTER_LOGS', 'EXPORT_LOGS'],
  };

  for (const [category, cmds] of Object.entries(categories)) {
    console.log(`  ── ${category} ──`);
    for (const cmd of cmds) {
      const def = COMMANDS[cmd];
      const roles = def.roles.join(', ');
      console.log(`    ${def.usage.padEnd(55)} [${roles}]`);
    }
    console.log('');
  }

  console.log(`Roles: Reporter, Redaktur, Pemred, Admin_Teknis`);
  console.log(`\nSetup: Run "node src/seed.js" to create the default admin user.\n`);
}

function formatOutput(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const icon = result.success ? '✓' : '✗';
    console.log(`\n${icon} ${result.message}`);
    if (result.data) {
      if (Array.isArray(result.data)) {
        if (result.data.length > 0) {
          console.log('');
          console.table(result.data);
        }
      } else {
        console.log('');
        for (const [key, value] of Object.entries(result.data)) {
          console.log(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
      }
    }
    console.log('');
  }
}

function main() {
  const rawArgs = process.argv.slice(2);

  // Check for --help
  if (rawArgs.length === 0 || rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Parse --user and --json flags
  let username = null;
  let jsonOutput = false;
  const commandArgs = [];
  let i = 0;

  while (i < rawArgs.length) {
    if (rawArgs[i] === '--user' || rawArgs[i] === '-u') {
      username = rawArgs[i + 1];
      i += 2;
    } else if (rawArgs[i] === '--json') {
      jsonOutput = true;
      i += 1;
    } else {
      commandArgs.push(rawArgs[i]);
      i += 1;
    }
  }

  if (!username) {
    console.error('Error: --user <username> is required. Use --help for usage.');
    process.exit(1);
  }

  if (commandArgs.length === 0) {
    console.error('Error: No command specified. Use --help for available commands.');
    process.exit(1);
  }

  const commandName = commandArgs[0].toUpperCase();
  const cmdArgs = commandArgs.slice(1);

  const commandDef = COMMANDS[commandName];
  if (!commandDef) {
    console.error(`Error: Unknown command '${commandName}'. Use --help for available commands.`);
    process.exit(1);
  }

  logger.info('CLI', `Command: ${commandName} | User: ${username} | Args: ${cmdArgs.join(' ')}`);

  try {
    const result = commandDef.handler(username, cmdArgs);
    formatOutput(result, jsonOutput);
    process.exit(result.success ? 0 : 1);
  } catch (err) {
    logger.error('CLI', `Unhandled error executing '${commandName}': ${err.message}`);
    const result = { success: false, message: `Internal error: ${err.message}` };
    formatOutput(result, jsonOutput);
    process.exit(2);
  }
}

main();
