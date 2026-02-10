/**
 * Audit Logger - Immutable JSONL Audit Trail
 * Compliance: UU Pers, UU ITE
 * 
 * All system actions are logged to immutable audit trail
 */

const fs = require('fs');
const path = require('path');

const AUDIT_LOG_ENABLED = process.env.AUDIT_LOG_ENABLED !== 'false';
const AUDIT_LOG_PATH = process.env.AUDIT_LOG_PATH || path.join(__dirname, '../../logs/audit.jsonl');

// Ensure logs directory exists
const logsDir = path.dirname(AUDIT_LOG_PATH);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log an audit event
 * @param {Object} event - Audit event object
 * @param {string} event.action - Action performed
 * @param {string} event.resource_type - Type of resource (ARTICLE, USER, SYSTEM, etc.)
 * @param {string} event.resource_id - ID of resource affected
 * @param {Object} event.details - Additional details
 * @param {string} event.user_id - User who performed action
 * @param {string} event.ip_address - IP address
 * @param {string} event.user_agent - User agent string
 */
function log(event) {
  if (!AUDIT_LOG_ENABLED) {
    return;
  }
  
  const auditEntry = {
    timestamp: new Date().toISOString(),
    action: event.action || 'UNKNOWN',
    resource_type: event.resource_type || null,
    resource_id: event.resource_id || null,
    user_id: event.user_id || null,
    details: event.details || {},
    ip_address: event.ip_address || null,
    user_agent: event.user_agent || null
  };
  
  // Append to JSONL file (one JSON object per line)
  const logLine = JSON.stringify(auditEntry) + '\n';
  
  try {
    fs.appendFileSync(AUDIT_LOG_PATH, logLine, 'utf8');
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * Read audit log entries
 * @param {Object} options - Query options
 * @param {number} options.limit - Max entries to return
 * @param {string} options.action - Filter by action
 * @param {string} options.user_id - Filter by user
 * @param {string} options.resource_type - Filter by resource type
 * @returns {Array} Array of audit entries
 */
function read(options = {}) {
  if (!fs.existsSync(AUDIT_LOG_PATH)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    let entries = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(entry => entry !== null);
    
    // Apply filters
    if (options.action) {
      entries = entries.filter(e => e.action === options.action);
    }
    if (options.user_id) {
      entries = entries.filter(e => e.user_id === options.user_id);
    }
    if (options.resource_type) {
      entries = entries.filter(e => e.resource_type === options.resource_type);
    }
    
    // Sort by timestamp descending (newest first)
    entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply limit
    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }
    
    return entries;
  } catch (error) {
    console.error('Failed to read audit log:', error);
    return [];
  }
}

module.exports = {
  log,
  read
};
