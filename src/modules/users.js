/**
 * User Management Module
 *
 * Commands:
 *   CREATE_USER <username> <email> <role>   — Admin_Teknis
 *   DELETE_USER <username>                  — Admin_Teknis
 *   UPDATE_USER_ROLE <username> <new_role>  — Admin_Teknis
 *   RESET_PASSWORD <username>               — Admin_Teknis
 *   LIST_USERS                               — Admin_Teknis
 */

import db from '../database.js';
import { hashPassword, isValidRole, authorize } from '../auth.js';
import config from '../config.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

const MODULE = 'USERS';
const ALLOWED_ROLES = ['Admin_Teknis'];

/**
 * CREATE_USER <username> <email> <role>
 */
export function createUser(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [username, email, role] = args;
  if (!username || !email || !role) {
    return { success: false, message: 'Usage: CREATE_USER <username> <email> <role>' };
  }

  if (!isValidRole(role)) {
    return { success: false, message: `Invalid role '${role}'. Valid roles: ${config.roles.join(', ')}` };
  }

  const existing = db.findOne('users', (u) => u.username === username);
  if (existing) {
    return { success: false, message: `User '${username}' already exists.` };
  }

  const { hash, salt } = hashPassword(config.defaultPassword);
  const user = db.insert('users', {
    username,
    email,
    role,
    passwordHash: hash,
    passwordSalt: salt,
    active: true,
  });

  logger.info(MODULE, `User '${username}' created with role '${role}' by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'CREATE_USER', MODULE, { username, email, role });

  return {
    success: true,
    message: `User '${username}' created successfully with role '${role}'. Default password assigned.`,
    data: { username: user.username, email: user.email, role: user.role },
  };
}

/**
 * DELETE_USER <username>
 */
export function deleteUser(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [targetUsername] = args;
  if (!targetUsername) {
    return { success: false, message: 'Usage: DELETE_USER <username>' };
  }

  if (targetUsername === callerUsername) {
    return { success: false, message: 'Cannot delete your own account.' };
  }

  const count = db.remove('users', (u) => u.username === targetUsername);
  if (count === 0) {
    return { success: false, message: `User '${targetUsername}' not found.` };
  }

  logger.info(MODULE, `User '${targetUsername}' deleted by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'DELETE_USER', MODULE, { targetUsername });

  return { success: true, message: `User '${targetUsername}' deleted successfully.` };
}

/**
 * UPDATE_USER_ROLE <username> <new_role>
 */
export function updateUserRole(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [targetUsername, newRole] = args;
  if (!targetUsername || !newRole) {
    return { success: false, message: 'Usage: UPDATE_USER_ROLE <username> <new_role>' };
  }

  if (!isValidRole(newRole)) {
    return { success: false, message: `Invalid role '${newRole}'. Valid roles: ${config.roles.join(', ')}` };
  }

  const user = db.findOne('users', (u) => u.username === targetUsername);
  if (!user) {
    return { success: false, message: `User '${targetUsername}' not found.` };
  }

  const oldRole = user.role;
  db.update('users', (u) => u.username === targetUsername, { role: newRole });

  logger.info(MODULE, `Role of '${targetUsername}' changed from '${oldRole}' to '${newRole}' by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'UPDATE_USER_ROLE', MODULE, { targetUsername, oldRole, newRole });

  return {
    success: true,
    message: `Role of '${targetUsername}' updated from '${oldRole}' to '${newRole}'.`,
  };
}

/**
 * RESET_PASSWORD <username>
 */
export function resetPassword(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [targetUsername] = args;
  if (!targetUsername) {
    return { success: false, message: 'Usage: RESET_PASSWORD <username>' };
  }

  const user = db.findOne('users', (u) => u.username === targetUsername);
  if (!user) {
    return { success: false, message: `User '${targetUsername}' not found.` };
  }

  const { hash, salt } = hashPassword(config.defaultPassword);
  db.update('users', (u) => u.username === targetUsername, {
    passwordHash: hash,
    passwordSalt: salt,
  });

  logger.info(MODULE, `Password reset for '${targetUsername}' by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'RESET_PASSWORD', MODULE, { targetUsername });

  return {
    success: true,
    message: `Password for '${targetUsername}' has been reset to the default.`,
  };
}

/**
 * LIST_USERS
 */
export function listUsers(callerUsername) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const users = db.read('users').map((u) => ({
    username: u.username,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u._createdAt,
  }));

  addAuditEntry(callerUsername, 'LIST_USERS', MODULE, { count: users.length });

  return {
    success: true,
    message: `Found ${users.length} user(s).`,
    data: users,
  };
}

export default { createUser, deleteUser, updateUserRole, resetPassword, listUsers };
