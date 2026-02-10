import { runQuery, getQuery, allQuery } from '../config/database.js';
import { logAudit } from '../utils/audit.js';
import {
  fetchAnalyticsMetric,
  fetchAdsData,
  fetchAdSenseData
} from '../integrations/analytics-api.js';

export async function checkAnalytics(metric, platform, executedBy = 'system') {
  try {
    const result = await fetchAnalyticsMetric(metric, platform);

    // Cache the result
    await runQuery(
      'INSERT INTO analytics_cache (platform, metric, value) VALUES (?, ?, ?)',
      [platform, metric, JSON.stringify(result.data)]
    );

    await logAudit(executedBy, 'analytics', 'CHECK_ANALYTICS',
      `Checked ${metric} for ${platform}`);

    return {
      success: result.success,
      platform,
      metric,
      data: result.data,
      message: result.message
    };
  } catch (error) {
    await logAudit(executedBy, 'analytics', 'CHECK_ANALYTICS_FAILED',
      `Failed to check analytics for ${metric} on ${platform}: ${error.message}`);
    throw error;
  }
}

export async function checkAds(campaignId, executedBy = 'system') {
  try {
    const result = await fetchAdsData(campaignId);

    await logAudit(executedBy, 'analytics', 'CHECK_ADS',
      `Checked ads campaign ${campaignId}`);

    return {
      success: result.success,
      campaignId,
      data: result.data,
      message: result.message
    };
  } catch (error) {
    await logAudit(executedBy, 'analytics', 'CHECK_ADS_FAILED',
      `Failed to check ads campaign ${campaignId}: ${error.message}`);
    throw error;
  }
}

export async function checkAdSense(siteId, executedBy = 'system') {
  try {
    const result = await fetchAdSenseData(siteId);

    await logAudit(executedBy, 'analytics', 'CHECK_ADSENSE',
      `Checked AdSense for site ${siteId}`);

    return {
      success: result.success,
      siteId,
      data: result.data,
      message: result.message
    };
  } catch (error) {
    await logAudit(executedBy, 'analytics', 'CHECK_ADSENSE_FAILED',
      `Failed to check AdSense for site ${siteId}: ${error.message}`);
    throw error;
  }
}

export async function listMetrics(executedBy = 'system') {
  try {
    const metrics = await allQuery(
      'SELECT * FROM analytics_cache ORDER BY cached_at DESC LIMIT 100'
    );

    await logAudit(executedBy, 'analytics', 'LIST_METRICS',
      `Listed ${metrics.length} cached metrics`);

    return {
      success: true,
      count: metrics.length,
      metrics
    };
  } catch (error) {
    await logAudit(executedBy, 'analytics', 'LIST_METRICS_FAILED',
      `Failed to list metrics: ${error.message}`);
    throw error;
  }
}
