/**
 * Content / Draft Management Module
 *
 * Commands:
 *   SUBMIT_DRAFT <draft_id> <title> <content> <author>   — Reporter
 *   EDIT_DRAFT <draft_id> <field>=<value>               — Reporter/Redaktur
 *   APPROVE_DRAFT <draft_id>                            — Redaktur/Pemred
 *   REJECT_DRAFT <draft_id> <reason>                   — Redaktur/Pemred
 *   LIST_DRAFTS <status>                                — Redaktur/Pemred
 */

import db from '../database.js';
import { authorize } from '../auth.js';
import config from '../config.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

const MODULE = 'CONTENT';

/**
 * SUBMIT_DRAFT <draft_id> <title> <content> <author>
 */
export function submitDraft(callerUsername, args) {
  const auth = authorize(callerUsername, ['Reporter', 'Redaktur', 'Pemred', 'Admin_Teknis']);
  if (!auth.success) return auth;

  const [draftId, title, content, author] = args;
  if (!draftId || !title || !content) {
    return { success: false, message: 'Usage: SUBMIT_DRAFT <draft_id> <title> <content> [author]' };
  }

  const existing = db.findOne('drafts', (d) => d.draftId === draftId);
  if (existing) {
    return { success: false, message: `Draft '${draftId}' already exists.` };
  }

  const draft = db.insert('drafts', {
    draftId,
    title,
    content,
    author: author || callerUsername,
    status: 'submitted',
    history: [{ action: 'submitted', by: callerUsername, at: new Date().toISOString() }],
  });

  logger.info(MODULE, `Draft '${draftId}' submitted by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'SUBMIT_DRAFT', MODULE, { draftId, title });

  return {
    success: true,
    message: `Draft '${draftId}' submitted successfully.`,
    data: { draftId: draft.draftId, title: draft.title, status: draft.status },
  };
}

/**
 * EDIT_DRAFT <draft_id> <field>=<value>
 */
export function editDraft(callerUsername, args) {
  const auth = authorize(callerUsername, ['Reporter', 'Redaktur', 'Pemred', 'Admin_Teknis']);
  if (!auth.success) return auth;

  const [draftId, ...fieldPairs] = args;
  if (!draftId || fieldPairs.length === 0) {
    return { success: false, message: 'Usage: EDIT_DRAFT <draft_id> <field>=<value> [field2=value2 ...]' };
  }

  const draft = db.findOne('drafts', (d) => d.draftId === draftId);
  if (!draft) {
    return { success: false, message: `Draft '${draftId}' not found.` };
  }

  // Reporters can only edit their own drafts
  if (auth.user.role === 'Reporter' && draft.author !== callerUsername) {
    return { success: false, message: 'Reporters can only edit their own drafts.' };
  }

  const updates = {};
  const editableFields = ['title', 'content', 'author'];
  for (const pair of fieldPairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) {
      return { success: false, message: `Invalid field format '${pair}'. Use field=value.` };
    }
    const field = pair.slice(0, eqIndex);
    const value = pair.slice(eqIndex + 1);
    if (!editableFields.includes(field)) {
      return { success: false, message: `Field '${field}' is not editable. Editable: ${editableFields.join(', ')}` };
    }
    updates[field] = value;
  }

  db.update('drafts', (d) => d.draftId === draftId, updates);

  // Append to history
  const allDrafts = db.read('drafts');
  const updated = allDrafts.find((d) => d.draftId === draftId);
  if (updated) {
    updated.history = updated.history || [];
    updated.history.push({ action: 'edited', by: callerUsername, fields: Object.keys(updates), at: new Date().toISOString() });
    db.write('drafts', allDrafts);
  }

  logger.info(MODULE, `Draft '${draftId}' edited by '${callerUsername}'. Fields: ${Object.keys(updates).join(', ')}`);
  addAuditEntry(callerUsername, 'EDIT_DRAFT', MODULE, { draftId, fields: Object.keys(updates) });

  return {
    success: true,
    message: `Draft '${draftId}' updated. Fields changed: ${Object.keys(updates).join(', ')}.`,
  };
}

/**
 * APPROVE_DRAFT <draft_id>
 */
export function approveDraft(callerUsername, args) {
  const auth = authorize(callerUsername, ['Redaktur', 'Pemred', 'Admin_Teknis']);
  if (!auth.success) return auth;

  const [draftId] = args;
  if (!draftId) {
    return { success: false, message: 'Usage: APPROVE_DRAFT <draft_id>' };
  }

  const draft = db.findOne('drafts', (d) => d.draftId === draftId);
  if (!draft) {
    return { success: false, message: `Draft '${draftId}' not found.` };
  }

  if (draft.status === 'approved') {
    return { success: false, message: `Draft '${draftId}' is already approved.` };
  }

  if (draft.status === 'published') {
    return { success: false, message: `Draft '${draftId}' is already published.` };
  }

  db.update('drafts', (d) => d.draftId === draftId, { status: 'approved' });

  const allDrafts = db.read('drafts');
  const updated = allDrafts.find((d) => d.draftId === draftId);
  if (updated) {
    updated.history = updated.history || [];
    updated.history.push({ action: 'approved', by: callerUsername, at: new Date().toISOString() });
    db.write('drafts', allDrafts);
  }

  logger.info(MODULE, `Draft '${draftId}' approved by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'APPROVE_DRAFT', MODULE, { draftId });

  return { success: true, message: `Draft '${draftId}' has been approved.` };
}

/**
 * REJECT_DRAFT <draft_id> <reason>
 */
export function rejectDraft(callerUsername, args) {
  const auth = authorize(callerUsername, ['Redaktur', 'Pemred', 'Admin_Teknis']);
  if (!auth.success) return auth;

  const [draftId, ...reasonParts] = args;
  const reason = reasonParts.join(' ');
  if (!draftId || !reason) {
    return { success: false, message: 'Usage: REJECT_DRAFT <draft_id> <reason>' };
  }

  const draft = db.findOne('drafts', (d) => d.draftId === draftId);
  if (!draft) {
    return { success: false, message: `Draft '${draftId}' not found.` };
  }

  db.update('drafts', (d) => d.draftId === draftId, { status: 'rejected', rejectReason: reason });

  const allDrafts = db.read('drafts');
  const updated = allDrafts.find((d) => d.draftId === draftId);
  if (updated) {
    updated.history = updated.history || [];
    updated.history.push({ action: 'rejected', by: callerUsername, reason, at: new Date().toISOString() });
    db.write('drafts', allDrafts);
  }

  logger.info(MODULE, `Draft '${draftId}' rejected by '${callerUsername}'. Reason: ${reason}`);
  addAuditEntry(callerUsername, 'REJECT_DRAFT', MODULE, { draftId, reason });

  return { success: true, message: `Draft '${draftId}' has been rejected. Reason: ${reason}` };
}

/**
 * LIST_DRAFTS [status]
 */
export function listDrafts(callerUsername, args) {
  const auth = authorize(callerUsername, ['Redaktur', 'Pemred', 'Admin_Teknis']);
  if (!auth.success) return auth;

  const [status] = args;
  let drafts;

  if (status) {
    if (!config.draftStatuses.includes(status)) {
      return { success: false, message: `Invalid status '${status}'. Valid: ${config.draftStatuses.join(', ')}` };
    }
    drafts = db.findMany('drafts', (d) => d.status === status);
  } else {
    drafts = db.read('drafts');
  }

  const result = drafts.map((d) => ({
    draftId: d.draftId,
    title: d.title,
    author: d.author,
    status: d.status,
    createdAt: d._createdAt,
    updatedAt: d._updatedAt,
  }));

  addAuditEntry(callerUsername, 'LIST_DRAFTS', MODULE, { status: status || 'all', count: result.length });

  return {
    success: true,
    message: `Found ${result.length} draft(s)${status ? ` with status '${status}'` : ''}.`,
    data: result,
  };
}

export default { submitDraft, editDraft, approveDraft, rejectDraft, listDrafts };
