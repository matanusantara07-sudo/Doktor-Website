import { runQuery, getQuery, allQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import { pingServer, checkAPI, checkService } from '../integrations/monitoring-api.js';

export async function monitorPingServer(serverUrl, executedBy = 'system') {
  try {
    const pingResult = await pingServer(serverUrl);

    // Update or create server record
    const existing = await getQuery('SELECT id FROM servers WHERE url = ?', [serverUrl]);

    if (existing) {
      await runQuery(
        'UPDATE servers SET status = ?, last_check = CURRENT_TIMESTAMP WHERE url = ?',
        [pingResult.success ? 'online' : 'offline', serverUrl]
      );
    } else {
      await runQuery(
        'INSERT INTO servers (name, url, status, last_check) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [serverUrl, serverUrl, pingResult.success ? 'online' : 'offline']
      );
    }

    await logAudit(executedBy, 'monitoring', 'PING_SERVER',
      `Pinged server ${serverUrl}: ${pingResult.success ? 'online' : 'offline'}`);

    return {
      success: true,
      serverUrl,
      status: pingResult.success ? 'online' : 'offline',
      responseTime: pingResult.responseTime,
      message: pingResult.message
    };
  } catch (error) {
    await logAudit(executedBy, 'monitoring', 'PING_SERVER_FAILED',
      `Failed to ping server ${serverUrl}: ${error.message}`);
    throw error;
  }
}

export async function monitorCheckAPI(apiUrl, executedBy = 'system') {
  try {
    const checkResult = await checkAPI(apiUrl);

    await logAudit(executedBy, 'monitoring', 'CHECK_API',
      `Checked API ${apiUrl}: ${checkResult.success ? 'OK' : 'Failed'}`);

    return {
      success: checkResult.success,
      apiUrl,
      status: checkResult.status,
      responseTime: checkResult.responseTime,
      message: checkResult.message,
      data: checkResult.data
    };
  } catch (error) {
    await logAudit(executedBy, 'monitoring', 'CHECK_API_FAILED',
      `Failed to check API ${apiUrl}: ${error.message}`);
    throw error;
  }
}

export async function monitorCheckService(serviceName, serverUrl, executedBy = 'system') {
  try {
    const checkResult = await checkService(serviceName, serverUrl);

    // Get or create server
    let server = await getQuery('SELECT id FROM servers WHERE url = ?', [serverUrl]);
    if (!server) {
      const result = await runQuery(
        'INSERT INTO servers (name, url, status, last_check) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [serverUrl, serverUrl, 'unknown']
      );
      server = { id: result.lastID };
    }

    // Update or create service record
    const existingService = await getQuery(
      'SELECT id FROM services WHERE name = ? AND server_id = ?',
      [serviceName, server.id]
    );

    if (existingService) {
      await runQuery(
        'UPDATE services SET status = ?, last_check = CURRENT_TIMESTAMP WHERE id = ?',
        [checkResult.success ? 'running' : 'error', existingService.id]
      );
    } else {
      await runQuery(
        'INSERT INTO services (name, server_id, status, last_check) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [serviceName, server.id, checkResult.success ? 'running' : 'error']
      );
    }

    await logAudit(executedBy, 'monitoring', 'CHECK_SERVICE',
      `Checked service ${serviceName} on ${serverUrl}: ${checkResult.success ? 'running' : 'error'}`);

    return {
      success: checkResult.success,
      serviceName,
      serverUrl,
      status: checkResult.success ? 'running' : 'error',
      message: checkResult.message,
      details: checkResult.details
    };
  } catch (error) {
    await logAudit(executedBy, 'monitoring', 'CHECK_SERVICE_FAILED',
      `Failed to check service ${serviceName} on ${serverUrl}: ${error.message}`);
    throw error;
  }
}

export async function listServers(executedBy = 'system') {
  try {
    const servers = await allQuery(
      'SELECT * FROM servers ORDER BY last_check DESC'
    );

    await logAudit(executedBy, 'monitoring', 'LIST_SERVERS',
      `Listed ${servers.length} servers`);

    return {
      success: true,
      count: servers.length,
      servers
    };
  } catch (error) {
    await logAudit(executedBy, 'monitoring', 'LIST_SERVERS_FAILED',
      `Failed to list servers: ${error.message}`);
    throw error;
  }
}

export async function listServices(executedBy = 'system') {
  try {
    const services = await allQuery(
      `SELECT s.*, srv.name as server_name, srv.url as server_url
       FROM services s
       JOIN servers srv ON s.server_id = srv.id
       ORDER BY s.last_check DESC`
    );

    await logAudit(executedBy, 'monitoring', 'LIST_SERVICES',
      `Listed ${services.length} services`);

    return {
      success: true,
      count: services.length,
      services
    };
  } catch (error) {
    await logAudit(executedBy, 'monitoring', 'LIST_SERVICES_FAILED',
      `Failed to list services: ${error.message}`);
    throw error;
  }
}
