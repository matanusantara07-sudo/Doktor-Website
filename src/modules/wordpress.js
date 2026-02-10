/**
 * WordPress Integration Module
 *
 * Commands:
 *   UPLOAD_WP <draft_id>                    — Admin_Teknis
 *   UPDATE_WP_STATUS <draft_id> <status>   — Admin_Teknis
 *   CHECK_WP_CONNECTION                     — Admin_Teknis
 */

import db from '../database.js';
import { authorize } from '../auth.js';
import config from '../config.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

const MODULE = 'WORDPRESS';
const ALLOWED_ROLES = ['Admin_Teknis'];

/**
 * UPLOAD_WP <draft_id>
 */
export function uploadWp(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [draftId] = args;
  if (!draftId) {
    return { success: false, message: 'Usage: UPLOAD_WP <draft_id>' };
  }

  const draft = db.findOne('drafts', (d) => d.draftId === draftId);
  if (!draft) {
    return { success: false, message: `Draft '${draftId}' not found.` };
  }

  if (draft.status !== 'approved' && draft.status !== 'published') {
    return { success: false, message: `Draft '${draftId}' must be approved before uploading to WordPress. Current status: '${draft.status}'.` };
  }

  // Check if already uploaded
  const existingWp = db.findOne('wp_uploads', (w) => w.draftId === draftId);
  if (existingWp) {
    return { success: false, message: `Draft '${draftId}' has already been uploaded to WordPress (WP ID: ${existingWp.wpPostId}).` };
  }

  // Simulate WordPress upload
  const wpPostId = `wp_${Date.now()}`;
  const wpRecord = db.insert('wp_uploads', {
    draftId,
    wpPostId,
    wpStatus: 'draft',
    title: draft.title,
    uploadedBy: callerUsername,
    uploadedAt: new Date().toISOString(),
    wpUrl: `${config.wpApiPath}/posts/${wpPostId}`,
  });

  // Update draft status
  db.update('drafts', (d) => d.draftId === draftId, { status: 'published', wpPostId });

  logger.info(MODULE, `Draft '${draftId}' uploaded to WordPress as '${wpPostId}' by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'UPLOAD_WP', MODULE, { draftId, wpPostId });

  return {
    success: true,
    message: `Draft '${draftId}' uploaded to WordPress. WP Post ID: ${wpPostId}.`,
    data: { draftId, wpPostId, wpStatus: wpRecord.wpStatus, wpUrl: wpRecord.wpUrl },
  };
}

/**
 * UPDATE_WP_STATUS <draft_id> <status>
 */
export function updateWpStatus(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [draftId, status] = args;
  if (!draftId || !status) {
    return { success: false, message: 'Usage: UPDATE_WP_STATUS <draft_id> <status>' };
  }

  const validWpStatuses = ['draft', 'pending', 'publish', 'future', 'private', 'trash'];
  if (!validWpStatuses.includes(status)) {
    return { success: false, message: `Invalid WordPress status '${status}'. Valid: ${validWpStatuses.join(', ')}` };
  }

  const wpRecord = db.findOne('wp_uploads', (w) => w.draftId === draftId);
  if (!wpRecord) {
    return { success: false, message: `No WordPress upload found for draft '${draftId}'. Upload it first with UPLOAD_WP.` };
  }

  const oldStatus = wpRecord.wpStatus;
  db.update('wp_uploads', (w) => w.draftId === draftId, { wpStatus: status });

  logger.info(MODULE, `WP status for draft '${draftId}' changed from '${oldStatus}' to '${status}' by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'UPDATE_WP_STATUS', MODULE, { draftId, oldStatus, newStatus: status });

  return {
    success: true,
    message: `WordPress status for draft '${draftId}' updated from '${oldStatus}' to '${status}'.`,
  };
}

/**
 * CHECK_WP_CONNECTION
 */
export function checkWpConnection(callerUsername) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  // Simulate connection check
  const connectionStatus = {
    connected: true,
    apiEndpoint: config.wpApiPath,
    version: '6.4.2',
    authenticated: true,
    lastChecked: new Date().toISOString(),
  };

  logger.info(MODULE, `WordPress connection checked by '${callerUsername}'. Status: connected.`);
  addAuditEntry(callerUsername, 'CHECK_WP_CONNECTION', MODULE, connectionStatus);

  return {
    success: true,
    message: 'WordPress connection is active.',
    data: connectionStatus,
  };
}

export default { uploadWp, updateWpStatus, checkWpConnection };
