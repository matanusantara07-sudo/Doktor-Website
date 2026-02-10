import { runQuery, getQuery, allQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';

const VALID_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'published'];

export async function submitDraft(draftId, title, content, author, executedBy = 'system') {
  try {
    if (draftId) {
      // Update existing draft
      const existing = await getQuery('SELECT id FROM drafts WHERE id = ?', [draftId]);
      if (!existing) {
        throw new Error('Draft not found');
      }

      await runQuery(
        'UPDATE drafts SET title = ?, content = ?, author = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [title, content, author, 'submitted', draftId]
      );

      await logAudit(executedBy, 'content_management', 'SUBMIT_DRAFT',
        `Updated and submitted draft ${draftId}: ${title}`);

      return {
        success: true,
        draftId,
        message: 'Draft updated and submitted successfully'
      };
    } else {
      // Create new draft
      const result = await runQuery(
        'INSERT INTO drafts (title, content, author, status) VALUES (?, ?, ?, ?)',
        [title, content, author, 'submitted']
      );

      await logAudit(executedBy, 'content_management', 'SUBMIT_DRAFT',
        `Created and submitted new draft: ${title}`);

      return {
        success: true,
        draftId: result.lastID,
        message: 'Draft created and submitted successfully'
      };
    }
  } catch (error) {
    await logAudit(executedBy, 'content_management', 'SUBMIT_DRAFT_FAILED',
      `Failed to submit draft: ${error.message}`);
    throw error;
  }
}

export async function editDraft(draftId, updates, executedBy = 'system') {
  try {
    const draft = await getQuery('SELECT * FROM drafts WHERE id = ?', [draftId]);
    if (!draft) {
      throw new Error('Draft not found');
    }

    const allowedFields = ['title', 'content', 'author', 'status'];
    const updateFields = [];
    const updateValues = [];

    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field)) {
        if (field === 'status' && !VALID_STATUSES.includes(value)) {
          throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
        }
        updateFields.push(`${field} = ?`);
        updateValues.push(value);
      }
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(draftId);

    await runQuery(
      `UPDATE drafts SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    await logAudit(executedBy, 'content_management', 'EDIT_DRAFT',
      `Edited draft ${draftId}: ${Object.keys(updates).join(', ')}`);

    return {
      success: true,
      draftId,
      updatedFields: Object.keys(updates),
      message: 'Draft updated successfully'
    };
  } catch (error) {
    await logAudit(executedBy, 'content_management', 'EDIT_DRAFT_FAILED',
      `Failed to edit draft ${draftId}: ${error.message}`);
    throw error;
  }
}

export async function approveDraft(draftId, executedBy = 'system') {
  try {
    const draft = await getQuery('SELECT status FROM drafts WHERE id = ?', [draftId]);
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.status !== 'submitted') {
      throw new Error(`Draft must be in 'submitted' status to be approved. Current status: ${draft.status}`);
    }

    await runQuery(
      'UPDATE drafts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['approved', draftId]
    );

    await logAudit(executedBy, 'content_management', 'APPROVE_DRAFT',
      `Approved draft ${draftId}`);

    return {
      success: true,
      draftId,
      message: 'Draft approved successfully'
    };
  } catch (error) {
    await logAudit(executedBy, 'content_management', 'APPROVE_DRAFT_FAILED',
      `Failed to approve draft ${draftId}: ${error.message}`);
    throw error;
  }
}

export async function rejectDraft(draftId, reason, executedBy = 'system') {
  try {
    const draft = await getQuery('SELECT status FROM drafts WHERE id = ?', [draftId]);
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.status !== 'submitted') {
      throw new Error(`Draft must be in 'submitted' status to be rejected. Current status: ${draft.status}`);
    }

    await runQuery(
      'UPDATE drafts SET status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['rejected', reason, draftId]
    );

    await logAudit(executedBy, 'content_management', 'REJECT_DRAFT',
      `Rejected draft ${draftId}: ${reason}`);

    return {
      success: true,
      draftId,
      reason,
      message: 'Draft rejected successfully'
    };
  } catch (error) {
    await logAudit(executedBy, 'content_management', 'REJECT_DRAFT_FAILED',
      `Failed to reject draft ${draftId}: ${error.message}`);
    throw error;
  }
}

export async function listDrafts(status = null, executedBy = 'system') {
  try {
    let query = 'SELECT * FROM drafts';
    let params = [];

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY updated_at DESC';

    const drafts = await allQuery(query, params);

    await logAudit(executedBy, 'content_management', 'LIST_DRAFTS',
      `Listed ${drafts.length} drafts${status ? ` with status ${status}` : ''}`);

    return {
      success: true,
      count: drafts.length,
      status: status || 'all',
      drafts
    };
  } catch (error) {
    await logAudit(executedBy, 'content_management', 'LIST_DRAFTS_FAILED',
      `Failed to list drafts: ${error.message}`);
    throw error;
  }
}
