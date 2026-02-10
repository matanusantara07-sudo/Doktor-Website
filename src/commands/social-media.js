import { runQuery, getQuery, allQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import { publishToFacebook, publishToTwitter, publishToInstagram } from '../integrations/social-platforms.js';

const VALID_PLATFORMS = ['facebook', 'twitter', 'instagram'];

export async function publishSocial(draftId, platformList, scheduleTime = null, executedBy = 'system') {
  try {
    const draft = await getQuery('SELECT * FROM drafts WHERE id = ?', [draftId]);
    if (!draft) {
      throw new Error('Draft not found');
    }

    if (draft.status !== 'approved') {
      throw new Error(`Draft must be approved before publishing. Current status: ${draft.status}`);
    }

    const platforms = platformList.split(',').map(p => p.trim().toLowerCase());
    const results = [];

    for (const platform of platforms) {
      if (!VALID_PLATFORMS.includes(platform)) {
        results.push({
          platform,
          success: false,
          error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`
        });
        continue;
      }

      try {
        const status = scheduleTime ? 'scheduled' : 'pending';
        const result = await runQuery(
          'INSERT INTO social_publications (draft_id, platform, status, scheduled_time) VALUES (?, ?, ?, ?)',
          [draftId, platform, status, scheduleTime]
        );

        // If not scheduled, publish immediately
        if (!scheduleTime) {
          let publishResult;
          switch (platform) {
            case 'facebook':
              publishResult = await publishToFacebook(draft.title, draft.content);
              break;
            case 'twitter':
              publishResult = await publishToTwitter(draft.title, draft.content);
              break;
            case 'instagram':
              publishResult = await publishToInstagram(draft.title, draft.content);
              break;
          }

          if (publishResult.success) {
            await runQuery(
              'UPDATE social_publications SET status = ?, published_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              ['published', publishResult.url, result.lastID]
            );
          } else {
            await runQuery(
              'UPDATE social_publications SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              ['failed', publishResult.error, result.lastID]
            );
          }

          results.push({
            platform,
            success: publishResult.success,
            url: publishResult.url,
            error: publishResult.error
          });
        } else {
          results.push({
            platform,
            success: true,
            scheduled: true,
            scheduledTime: scheduleTime
          });
        }
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error.message
        });
      }
    }

    await logAudit(executedBy, 'social_media', 'PUBLISH_SOCIAL',
      `Published draft ${draftId} to platforms: ${platformList}`);

    return {
      success: true,
      draftId,
      results
    };
  } catch (error) {
    await logAudit(executedBy, 'social_media', 'PUBLISH_SOCIAL_FAILED',
      `Failed to publish draft ${draftId}: ${error.message}`);
    throw error;
  }
}

export async function retryPublish(draftId, platformList, executedBy = 'system') {
  try {
    const draft = await getQuery('SELECT * FROM drafts WHERE id = ?', [draftId]);
    if (!draft) {
      throw new Error('Draft not found');
    }

    const platforms = platformList.split(',').map(p => p.trim().toLowerCase());
    const results = [];

    for (const platform of platforms) {
      if (!VALID_PLATFORMS.includes(platform)) {
        results.push({
          platform,
          success: false,
          error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`
        });
        continue;
      }

      const publication = await getQuery(
        'SELECT * FROM social_publications WHERE draft_id = ? AND platform = ? AND status = ?',
        [draftId, platform, 'failed']
      );

      if (!publication) {
        results.push({
          platform,
          success: false,
          error: 'No failed publication found for this platform'
        });
        continue;
      }

      try {
        let publishResult;
        switch (platform) {
          case 'facebook':
            publishResult = await publishToFacebook(draft.title, draft.content);
            break;
          case 'twitter':
            publishResult = await publishToTwitter(draft.title, draft.content);
            break;
          case 'instagram':
            publishResult = await publishToInstagram(draft.title, draft.content);
            break;
        }

        if (publishResult.success) {
          await runQuery(
            'UPDATE social_publications SET status = ?, published_url = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['published', publishResult.url, publication.id]
          );
          results.push({
            platform,
            success: true,
            url: publishResult.url
          });
        } else {
          await runQuery(
            'UPDATE social_publications SET error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [publishResult.error, publication.id]
          );
          results.push({
            platform,
            success: false,
            error: publishResult.error
          });
        }
      } catch (error) {
        results.push({
          platform,
          success: false,
          error: error.message
        });
      }
    }

    await logAudit(executedBy, 'social_media', 'RETRY_PUBLISH',
      `Retried publishing draft ${draftId} to platforms: ${platformList}`);

    return {
      success: true,
      draftId,
      results
    };
  } catch (error) {
    await logAudit(executedBy, 'social_media', 'RETRY_PUBLISH_FAILED',
      `Failed to retry publish draft ${draftId}: ${error.message}`);
    throw error;
  }
}

export async function checkStatus(draftId, platform, executedBy = 'system') {
  try {
    if (!VALID_PLATFORMS.includes(platform)) {
      throw new Error(`Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`);
    }

    const publication = await getQuery(
      'SELECT * FROM social_publications WHERE draft_id = ? AND platform = ?',
      [draftId, platform]
    );

    if (!publication) {
      throw new Error(`No publication found for draft ${draftId} on ${platform}`);
    }

    await logAudit(executedBy, 'social_media', 'CHECK_STATUS',
      `Checked status for draft ${draftId} on ${platform}: ${publication.status}`);

    return {
      success: true,
      draftId,
      platform,
      status: publication.status,
      publishedUrl: publication.published_url,
      errorMessage: publication.error_message,
      scheduledTime: publication.scheduled_time,
      updatedAt: publication.updated_at
    };
  } catch (error) {
    await logAudit(executedBy, 'social_media', 'CHECK_STATUS_FAILED',
      `Failed to check status for draft ${draftId} on ${platform}: ${error.message}`);
    throw error;
  }
}
