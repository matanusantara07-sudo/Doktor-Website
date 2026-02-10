import { allQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';

export async function listLogs(dateRange = null, executedBy = 'system') {
  try {
    let query = 'SELECT * FROM audit_logs';
    let params = [];

    if (dateRange) {
      // Parse date range (format: YYYY-MM-DD:YYYY-MM-DD)
      const [startDate, endDate] = dateRange.split(':');
      if (startDate && endDate) {
        query += ' WHERE DATE(created_at) BETWEEN ? AND ?';
        params = [startDate, endDate];
      } else if (startDate) {
        query += ' WHERE DATE(created_at) = ?';
        params = [startDate];
      }
    }

    query += ' ORDER BY created_at DESC LIMIT 1000';

    const logs = await allQuery(query, params);

    await logAudit(executedBy, 'audit', 'LIST_LOGS',
      `Listed ${logs.length} audit logs${dateRange ? ` for date range ${dateRange}` : ''}`);

    return {
      success: true,
      count: logs.length,
      dateRange: dateRange || 'all',
      logs
    };
  } catch (error) {
    await logAudit(executedBy, 'audit', 'LIST_LOGS_FAILED',
      `Failed to list logs: ${error.message}`);
    throw error;
  }
}

export async function filterLogs(filterType, filterValue, executedBy = 'system') {
  try {
    let query = 'SELECT * FROM audit_logs WHERE ';
    let params = [];

    switch (filterType) {
      case 'user':
        query += 'user = ?';
        params = [filterValue];
        break;
      case 'module':
        query += 'module = ?';
        params = [filterValue];
        break;
      case 'action':
        query += 'action = ?';
        params = [filterValue];
        break;
      default:
        throw new Error('Invalid filter type. Must be one of: user, module, action');
    }

    query += ' ORDER BY created_at DESC LIMIT 1000';

    const logs = await allQuery(query, params);

    await logAudit(executedBy, 'audit', 'FILTER_LOGS',
      `Filtered logs by ${filterType}=${filterValue}: ${logs.length} results`);

    return {
      success: true,
      count: logs.length,
      filterType,
      filterValue,
      logs
    };
  } catch (error) {
    await logAudit(executedBy, 'audit', 'FILTER_LOGS_FAILED',
      `Failed to filter logs: ${error.message}`);
    throw error;
  }
}

export async function exportLogs(format, executedBy = 'system') {
  try {
    const logs = await allQuery(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10000'
    );

    let exportData;
    switch (format.toLowerCase()) {
      case 'json':
        exportData = JSON.stringify(logs, null, 2);
        break;
      case 'csv': {
        const headers = ['id', 'user', 'module', 'action', 'details', 'ip_address', 'created_at'];
        const csvRows = [headers.join(',')];
        logs.forEach(log => {
          const values = headers.map(header => {
            const val = log[header] || '';
            return `"${String(val).replace(/"/g, '""')}"`;
          });
          csvRows.push(values.join(','));
        });
        exportData = csvRows.join('\n');
        break;
      }
      case 'txt': {
        exportData = logs.map(log =>
          `[${log.created_at}] ${log.user} - ${log.module}.${log.action}: ${log.details || ''}`
        ).join('\n');
        break;
      }
      default:
        throw new Error('Invalid format. Must be one of: json, csv, txt');
    }

    await logAudit(executedBy, 'audit', 'EXPORT_LOGS',
      `Exported ${logs.length} logs in ${format} format`);

    return {
      success: true,
      count: logs.length,
      format,
      data: exportData
    };
  } catch (error) {
    await logAudit(executedBy, 'audit', 'EXPORT_LOGS_FAILED',
      `Failed to export logs: ${error.message}`);
    throw error;
  }
}
