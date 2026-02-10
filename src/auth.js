/**
 * Authentication and Role-Based Access Control (RBAC).
 *
 * Roles (Indonesian newsroom hierarchy):
 *   Reporter       — Can submit and edit own drafts
 *   Redaktur       — Can edit, approve, reject drafts
 *   Pemred         — Chief editor; can approve, reject, publish
 *   Admin_Teknis   — Full system access
 */

import crypto from 'node:crypto';
import db from './database.js';
import config from './config.js';
import logger from './logger.js';

const MODULE = 'AUTH';

/**
 * Hash a password with a salt using SHA-256.
 * @param {string} password
 * @param {string} [salt]
 * @returns {{ hash: string, salt: string }}
 */
export function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + password).digest('hex');
  return { hash, salt };
}

/**
 * Verify a password against a stored hash + salt.
 * @param {string} password
 * @param {string} storedHash
 * @param {string} storedSalt
 * @returns {boolean}
 */
export function verifyPassword(password, storedHash, storedSalt) {
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

/**
 * Validate that a role string is recognized.
 * @param {string} role
 * @returns {boolean}
 */
export function isValidRole(role) {
  return config.roles.includes(role);
}

/**
 * Check whether a user's role is authorized for a given set of allowed roles.
 * @param {string} userRole
 * @param {string[]} allowedRoles
 * @returns {boolean}
 */
export function isAuthorized(userRole, allowedRoles) {
  return allowedRoles.includes(userRole);
}

/**
 * Resolve the current user from the data store.
 * @param {string} username
 * @returns {{ success: boolean, user?: Object, message?: string }}
 */
export function resolveUser(username) {
  if (!username) {
    return { success: false, message: 'No username provided. Use --user <username>.' };
  }
  const user = db.findOne('users', (u) => u.username === username);
  if (!user) {
    return { success: false, message: `User '${username}' not found.` };
  }
  return { success: true, user };
}

/**
 * Middleware-style authorization check.
 * Returns a result object indicating success or an access-denied message.
 * @param {string} username
 * @param {string[]} allowedRoles
 * @returns {{ success: boolean, user?: Object, message?: string }}
 */
export function authorize(username, allowedRoles) {
  const resolved = resolveUser(username);
  if (!resolved.success) return resolved;

  if (!isAuthorized(resolved.user.role, allowedRoles)) {
    logger.warn(MODULE, `Access denied for '${username}' (role: ${resolved.user.role}). Required: ${allowedRoles.join(', ')}`);
    return {
      success: false,
      message: `Access denied. Role '${resolved.user.role}' is not authorized. Required roles: ${allowedRoles.join(', ')}.`,
    };
  }

  return { success: true, user: resolved.user };
}

export default { hashPassword, verifyPassword, isValidRole, isAuthorized, resolveUser, authorize };
