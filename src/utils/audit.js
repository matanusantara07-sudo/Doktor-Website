import { runQuery } from '../config/database.js';

export async function logAudit(user, module, action, details, ipAddress = null) {
  try {
    await runQuery(
      'INSERT INTO audit_logs (user, module, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [user, module, action, details, ipAddress]
    );
  } catch (error) {
    console.error('Failed to log audit:', error.message);
  }
}
