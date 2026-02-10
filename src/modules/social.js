/**
 * Auto-Publication Social Media Module
 *
 * Commands:
 *   PUBLISH_SOCIAL <draft_id> <platform_list> <schedule_time>  — Pemred/Admin_Teknis
 *   RETRY_PUBLISH <draft_id> <platform_list>                  — Pemred/Admin_Teknis
 *   CHECK_STATUS <draft_id> <platform>                        — Semua role
 */

import db from '../database.js';
import { authorize } from '../auth.js';
import config from '../config.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

const MODULE = 'SOCIAL';

function validatePlatforms(platformList) {
  const platforms = platformList.split(',').map((p) => p.trim().toLowerCase());
  const invalid = platforms.filter((p) => !config.socialPlatforms.includes(p));
  if (invalid.length > 0) {
    return { valid: false, message: `Invalid platform(s): ${invalid.join(', ')}. Supported: ${config.socialPlatforms.join(', ')}` };
  }
  return { valid: true, platforms };
}

/**
 * PUBLISH_SOCIAL <draft_id> <platform_list> <schedule_time>
 */
export function publishSocial(callerUsername, args) {
  const auth = authorize(callerUsername, ['Pemred', 'Admin_Teknis']);
  if (!auth.success) return auth;

  const [draftId, platformList, ...scheduleTimeParts] = args;
  const scheduleTime = scheduleTimeParts.join(' ');
  if (!draftId || !platformList) {
    return { success: false, message: 'Usage: PUBLISH_SOCIAL <draft_id> <platform_list> [schedule_time]' };
  }

  const draft = db.findOne('drafts', (d) => d.draftId === draftId);
  if (!draft) {
    return { success: false, message: `Draft '${draftId}' not found.` };
  }

  if (draft.status !== 'approved' && draft.status !== 'published') {
    return { success: false, message: `Draft '${draftId}' must be approved before publishing. Current status: '${draft.status}'.` };
  }

  const pv = validatePlatforms(platformList);
  if (!pv.valid) return { success: false, message: pv.message };

  const publishRecords = pv.platforms.map((platform) => ({
    draftId,
    platform,
    status: scheduleTime ? 'scheduled' : 'publishing',
    scheduledAt: scheduleTime || null,
    publishedAt: scheduleTime ? null : new Date().toISOString(),
    retries: 0,
    lastError: null,
  }));

  // Store or update social publish records
  const existing = db.read('social_publishes');
  for (const rec of publishRecords) {
    const idx = existing.findIndex((e) => e.draftId === rec.draftId && e.platform === rec.platform);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...rec, _updatedAt: new Date().toISOString() };
    } else {
      rec._createdAt = new Date().toISOString();
      rec._updatedAt = rec._createdAt;
      existing.push(rec);
    }
  }
  db.write('social_publishes', existing);

  // Simulate publishing (mark as published for non-scheduled)
  if (!scheduleTime) {
    for (const rec of publishRecords) {
      db.update('social_publishes', (r) => r.draftId === rec.draftId && r.platform === rec.platform, {
        status: 'published',
        publishedAt: new Date().toISOString(),
      });
    }
  }

  logger.info(MODULE, `Draft '${draftId}' ${scheduleTime ? 'scheduled' : 'published'} to: ${pv.platforms.join(', ')} by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'PUBLISH_SOCIAL', MODULE, { draftId, platforms: pv.platforms, scheduleTime: scheduleTime || 'immediate' });

  return {
    success: true,
    message: `Draft '${draftId}' ${scheduleTime ? `scheduled for ${scheduleTime}` : 'published'} on: ${pv.platforms.join(', ')}.`,
    data: publishRecords,
  };
}

/**
 * RETRY_PUBLISH <draft_id> <platform_list>
 */
export function retryPublish(callerUsername, args) {
  const auth = authorize(callerUsername, ['Pemred', 'Admin_Teknis']);
  if (!auth.success) return auth;

  const [draftId, platformList] = args;
  if (!draftId || !platformList) {
    return { success: false, message: 'Usage: RETRY_PUBLISH <draft_id> <platform_list>' };
  }

  const pv = validatePlatforms(platformList);
  if (!pv.valid) return { success: false, message: pv.message };

  const results = [];
  for (const platform of pv.platforms) {
    const record = db.findOne('social_publishes', (r) => r.draftId === draftId && r.platform === platform);
    if (!record) {
      results.push({ platform, status: 'not_found', message: `No publish record for '${draftId}' on '${platform}'.` });
      continue;
    }

    db.update(
      'social_publishes',
      (r) => r.draftId === draftId && r.platform === platform,
      { status: 'published', retries: (record.retries || 0) + 1, publishedAt: new Date().toISOString(), lastError: null }
    );
    results.push({ platform, status: 'retried', message: `Retry successful for '${platform}'.` });
  }

  logger.info(MODULE, `Retry publish for draft '${draftId}' on ${pv.platforms.join(', ')} by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'RETRY_PUBLISH', MODULE, { draftId, platforms: pv.platforms });

  return {
    success: true,
    message: `Retry completed for draft '${draftId}'.`,
    data: results,
  };
}

/**
 * CHECK_STATUS <draft_id> <platform>
 */
export function checkStatus(callerUsername, args) {
  // All roles can check status
  const auth = authorize(callerUsername, config.roles);
  if (!auth.success) return auth;

  const [draftId, platform] = args;
  if (!draftId) {
    return { success: false, message: 'Usage: CHECK_STATUS <draft_id> [platform]' };
  }

  let records;
  if (platform) {
    const p = platform.toLowerCase();
    if (!config.socialPlatforms.includes(p)) {
      return { success: false, message: `Invalid platform '${platform}'. Supported: ${config.socialPlatforms.join(', ')}` };
    }
    records = db.findMany('social_publishes', (r) => r.draftId === draftId && r.platform === p);
  } else {
    records = db.findMany('social_publishes', (r) => r.draftId === draftId);
  }

  if (records.length === 0) {
    return { success: false, message: `No publish records found for draft '${draftId}'${platform ? ` on '${platform}'` : ''}.` };
  }

  const data = records.map((r) => ({
    platform: r.platform,
    status: r.status,
    scheduledAt: r.scheduledAt,
    publishedAt: r.publishedAt,
    retries: r.retries,
    lastError: r.lastError,
  }));

  addAuditEntry(callerUsername, 'CHECK_STATUS', MODULE, { draftId, platform: platform || 'all' });

  return {
    success: true,
    message: `Found ${data.length} publish record(s) for draft '${draftId}'.`,
    data,
  };
}

export default { publishSocial, retryPublish, checkStatus };
