/**
 * Monitoring Server & Services Module
 *
 * Commands:
 *   PING_SERVER <server_url>                — Admin_Teknis
 *   CHECK_API <api_url>                     — Admin_Teknis
 *   CHECK_SERVICE <service_name> <server_url>  — Admin_Teknis
 *   LIST_SERVERS                            — Admin_Teknis
 *   LIST_SERVICES                           — Admin_Teknis
 */

import db from '../database.js';
import { authorize } from '../auth.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

const MODULE = 'MONITORING';
const ALLOWED_ROLES = ['Admin_Teknis'];

/**
 * PING_SERVER <server_url>
 */
export function pingServer(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [serverUrl] = args;
  if (!serverUrl) {
    return { success: false, message: 'Usage: PING_SERVER <server_url>' };
  }

  // Simulate ping
  const latencyMs = Math.floor(Math.random() * 150) + 10;
  const result = {
    serverUrl,
    status: 'reachable',
    latencyMs,
    checkedAt: new Date().toISOString(),
  };

  // Upsert server record
  const servers = db.read('servers');
  const idx = servers.findIndex((s) => s.serverUrl === serverUrl);
  if (idx >= 0) {
    servers[idx] = { ...servers[idx], ...result, _updatedAt: new Date().toISOString() };
  } else {
    result._createdAt = new Date().toISOString();
    result._updatedAt = result._createdAt;
    servers.push(result);
  }
  db.write('servers', servers);

  logger.info(MODULE, `Ping to '${serverUrl}': ${latencyMs}ms by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'PING_SERVER', MODULE, result);

  return {
    success: true,
    message: `Server '${serverUrl}' is reachable. Latency: ${latencyMs}ms.`,
    data: result,
  };
}

/**
 * CHECK_API <api_url>
 */
export function checkApi(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [apiUrl] = args;
  if (!apiUrl) {
    return { success: false, message: 'Usage: CHECK_API <api_url>' };
  }

  // Simulate API health check
  const responseTimeMs = Math.floor(Math.random() * 300) + 20;
  const result = {
    apiUrl,
    status: 'healthy',
    httpStatus: 200,
    responseTimeMs,
    checkedAt: new Date().toISOString(),
  };

  // Upsert API record
  const apis = db.read('apis');
  const idx = apis.findIndex((a) => a.apiUrl === apiUrl);
  if (idx >= 0) {
    apis[idx] = { ...apis[idx], ...result, _updatedAt: new Date().toISOString() };
  } else {
    result._createdAt = new Date().toISOString();
    result._updatedAt = result._createdAt;
    apis.push(result);
  }
  db.write('apis', apis);

  logger.info(MODULE, `API check '${apiUrl}': healthy (${responseTimeMs}ms) by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'CHECK_API', MODULE, result);

  return {
    success: true,
    message: `API '${apiUrl}' is healthy. Response time: ${responseTimeMs}ms.`,
    data: result,
  };
}

/**
 * CHECK_SERVICE <service_name> <server_url>
 */
export function checkService(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [serviceName, serverUrl] = args;
  if (!serviceName || !serverUrl) {
    return { success: false, message: 'Usage: CHECK_SERVICE <service_name> <server_url>' };
  }

  // Simulate service check
  const uptimeHours = Math.floor(Math.random() * 720) + 1;
  const memoryUsageMb = Math.floor(Math.random() * 512) + 64;
  const cpuPercent = (Math.random() * 80 + 5).toFixed(1);

  const result = {
    serviceName,
    serverUrl,
    status: 'running',
    uptimeHours,
    memoryUsageMb,
    cpuPercent: parseFloat(cpuPercent),
    checkedAt: new Date().toISOString(),
  };

  // Upsert service record
  const services = db.read('services');
  const idx = services.findIndex((s) => s.serviceName === serviceName && s.serverUrl === serverUrl);
  if (idx >= 0) {
    services[idx] = { ...services[idx], ...result, _updatedAt: new Date().toISOString() };
  } else {
    result._createdAt = new Date().toISOString();
    result._updatedAt = result._createdAt;
    services.push(result);
  }
  db.write('services', services);

  logger.info(MODULE, `Service '${serviceName}' on '${serverUrl}': running (uptime: ${uptimeHours}h) by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'CHECK_SERVICE', MODULE, result);

  return {
    success: true,
    message: `Service '${serviceName}' on '${serverUrl}' is running. Uptime: ${uptimeHours}h, Memory: ${memoryUsageMb}MB, CPU: ${cpuPercent}%.`,
    data: result,
  };
}

/**
 * LIST_SERVERS
 */
export function listServers(callerUsername) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const servers = db.read('servers').map((s) => ({
    serverUrl: s.serverUrl,
    status: s.status,
    latencyMs: s.latencyMs,
    checkedAt: s.checkedAt,
  }));

  addAuditEntry(callerUsername, 'LIST_SERVERS', MODULE, { count: servers.length });

  return {
    success: true,
    message: `Found ${servers.length} server(s).`,
    data: servers,
  };
}

/**
 * LIST_SERVICES
 */
export function listServices(callerUsername) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const services = db.read('services').map((s) => ({
    serviceName: s.serviceName,
    serverUrl: s.serverUrl,
    status: s.status,
    uptimeHours: s.uptimeHours,
    checkedAt: s.checkedAt,
  }));

  addAuditEntry(callerUsername, 'LIST_SERVICES', MODULE, { count: services.length });

  return {
    success: true,
    message: `Found ${services.length} service(s).`,
    data: services,
  };
}

export default { pingServer, checkApi, checkService, listServers, listServices };
