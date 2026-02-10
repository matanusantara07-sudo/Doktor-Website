import { runQuery, getQuery, allQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import crypto from 'crypto';

const VALID_ROLES = ['Admin_Teknis', 'Reporter', 'Redaktur', 'Pemred'];

export async function createUser(username, email, role, executedBy = 'system') {
  try {
    // Validate role
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    // Check if user already exists
    const existing = await getQuery(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing) {
      throw new Error('User with this username or email already exists');
    }

    // Generate random password
    const tempPassword = crypto.randomBytes(12).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(tempPassword).digest('hex');

    // Create user
    const result = await runQuery(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, role]
    );

    await logAudit(executedBy, 'user_management', 'CREATE_USER',
      `Created user: ${username} with role: ${role}`);

    return {
      success: true,
      userId: result.lastID,
      username,
      email,
      role,
      temporaryPassword: tempPassword,
      message: 'User created successfully. Please provide the temporary password to the user.'
    };
  } catch (error) {
    await logAudit(executedBy, 'user_management', 'CREATE_USER_FAILED',
      `Failed to create user ${username}: ${error.message}`);
    throw error;
  }
}

export async function deleteUser(username, executedBy = 'system') {
  try {
    const user = await getQuery('SELECT id FROM users WHERE username = ?', [username]);

    if (!user) {
      throw new Error('User not found');
    }

    await runQuery('DELETE FROM users WHERE username = ?', [username]);

    await logAudit(executedBy, 'user_management', 'DELETE_USER',
      `Deleted user: ${username}`);

    return {
      success: true,
      message: `User ${username} deleted successfully`
    };
  } catch (error) {
    await logAudit(executedBy, 'user_management', 'DELETE_USER_FAILED',
      `Failed to delete user ${username}: ${error.message}`);
    throw error;
  }
}

export async function updateUserRole(username, newRole, executedBy = 'system') {
  try {
    // Validate role
    if (!VALID_ROLES.includes(newRole)) {
      throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }

    const user = await getQuery('SELECT id, role FROM users WHERE username = ?', [username]);

    if (!user) {
      throw new Error('User not found');
    }

    await runQuery(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?',
      [newRole, username]
    );

    await logAudit(executedBy, 'user_management', 'UPDATE_USER_ROLE',
      `Updated user ${username} role from ${user.role} to ${newRole}`);

    return {
      success: true,
      username,
      oldRole: user.role,
      newRole,
      message: `User ${username} role updated successfully`
    };
  } catch (error) {
    await logAudit(executedBy, 'user_management', 'UPDATE_USER_ROLE_FAILED',
      `Failed to update role for ${username}: ${error.message}`);
    throw error;
  }
}

export async function resetPassword(username, executedBy = 'system') {
  try {
    const user = await getQuery('SELECT id FROM users WHERE username = ?', [username]);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new random password
    const newPassword = crypto.randomBytes(12).toString('hex');
    const passwordHash = crypto.createHash('sha256').update(newPassword).digest('hex');

    await runQuery(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?',
      [passwordHash, username]
    );

    await logAudit(executedBy, 'user_management', 'RESET_PASSWORD',
      `Reset password for user: ${username}`);

    return {
      success: true,
      username,
      newPassword,
      message: 'Password reset successfully. Please provide the new password to the user.'
    };
  } catch (error) {
    await logAudit(executedBy, 'user_management', 'RESET_PASSWORD_FAILED',
      `Failed to reset password for ${username}: ${error.message}`);
    throw error;
  }
}

export async function listUsers(executedBy = 'system') {
  try {
    const users = await allQuery(
      'SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );

    await logAudit(executedBy, 'user_management', 'LIST_USERS',
      `Listed ${users.length} users`);

    return {
      success: true,
      count: users.length,
      users
    };
  } catch (error) {
    await logAudit(executedBy, 'user_management', 'LIST_USERS_FAILED',
      `Failed to list users: ${error.message}`);
    throw error;
  }
}
