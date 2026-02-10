import { runQuery, getQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import { uploadWordPressPost, updateWordPressStatus, checkWordPressConnection } from '../integrations/wordpress-api.js';

export async function uploadWP(draftId, executedBy = 'system') {
  try {
    const draft = await getQuery('SELECT * FROM drafts WHERE id = ?', [draftId]);
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.status !== 'approved') {
      throw new Error(`Draft must be approved before uploading to WordPress. Current status: ${draft.status}`);
    }

    // Check if already uploaded
    const existing = await getQuery(
      'SELECT * FROM wordpress_posts WHERE draft_id = ? AND status = ?',
      [draftId, 'uploaded']
    );

    if (existing) {
      throw new Error('Draft has already been uploaded to WordPress');
    }

    // Upload to WordPress
    const uploadResult = await uploadWordPressPost(draft.title, draft.content, draft.author);

    if (uploadResult.success) {
      await runQuery(
        'INSERT INTO wordpress_posts (draft_id, wp_post_id, status, wp_url) VALUES (?, ?, ?, ?)',
        [draftId, uploadResult.postId, 'uploaded', uploadResult.url]
      );

      // Update draft status to published
      await runQuery(
        'UPDATE drafts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['published', draftId]
      );

      await logAudit(executedBy, 'wordpress', 'UPLOAD_WP',
        `Uploaded draft ${draftId} to WordPress: ${uploadResult.url}`);

      return {
        success: true,
        draftId,
        wpPostId: uploadResult.postId,
        wpUrl: uploadResult.url,
        message: 'Draft uploaded to WordPress successfully'
      };
    } else {
      await runQuery(
        'INSERT INTO wordpress_posts (draft_id, status, error_message) VALUES (?, ?, ?)',
        [draftId, 'failed', uploadResult.error]
      );

      await logAudit(executedBy, 'wordpress', 'UPLOAD_WP_FAILED',
        `Failed to upload draft ${draftId}: ${uploadResult.error}`);

      throw new Error(`WordPress upload failed: ${uploadResult.error}`);
    }
  } catch (error) {
    await logAudit(executedBy, 'wordpress', 'UPLOAD_WP_FAILED',
      `Failed to upload draft ${draftId}: ${error.message}`);
    throw error;
  }
}

export async function updateWPStatus(draftId, status, executedBy = 'system') {
  try {
    const wpPost = await getQuery(
      'SELECT * FROM wordpress_posts WHERE draft_id = ? AND status = ?',
      [draftId, 'uploaded']
    );

    if (!wpPost) {
      throw new Error('WordPress post not found for this draft');
    }

    const updateResult = await updateWordPressStatus(wpPost.wp_post_id, status);

    if (updateResult.success) {
      await runQuery(
        'UPDATE wordpress_posts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [wpPost.id]
      );

      await logAudit(executedBy, 'wordpress', 'UPDATE_WP_STATUS',
        `Updated WordPress post ${wpPost.wp_post_id} status to ${status}`);

      return {
        success: true,
        draftId,
        wpPostId: wpPost.wp_post_id,
        newStatus: status,
        message: 'WordPress post status updated successfully'
      };
    } else {
      throw new Error(`WordPress status update failed: ${updateResult.error}`);
    }
  } catch (error) {
    await logAudit(executedBy, 'wordpress', 'UPDATE_WP_STATUS_FAILED',
      `Failed to update WordPress status for draft ${draftId}: ${error.message}`);
    throw error;
  }
}

export async function checkWPConnection(executedBy = 'system') {
  try {
    const connectionResult = await checkWordPressConnection();

    await logAudit(executedBy, 'wordpress', 'CHECK_WP_CONNECTION',
      `WordPress connection check: ${connectionResult.success ? 'Success' : 'Failed'}`);

    return {
      success: connectionResult.success,
      message: connectionResult.message,
      details: connectionResult.details
    };
  } catch (error) {
    await logAudit(executedBy, 'wordpress', 'CHECK_WP_CONNECTION_FAILED',
      `WordPress connection check failed: ${error.message}`);
    throw error;
  }
}
