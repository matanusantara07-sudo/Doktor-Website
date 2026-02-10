/**
 * Analytics & Ads Module
 *
 * Commands:
 *   CHECK_ANALYTICS <metric> <platform>   — Admin_Teknis
 *   CHECK_ADS <campaign_id>               — Admin_Teknis
 *   CHECK_ADSENSE <site_id>               — Admin_Teknis
 *   LIST_METRICS                          — Admin_Teknis
 */

import db from '../database.js';
import { authorize } from '../auth.js';
import config from '../config.js';
import logger from '../logger.js';
import { addAuditEntry } from './audit.js';

const MODULE = 'ANALYTICS';
const ALLOWED_ROLES = ['Admin_Teknis'];

/**
 * CHECK_ANALYTICS <metric> <platform>
 */
export function checkAnalytics(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [metric, platform] = args;
  if (!metric || !platform) {
    return { success: false, message: 'Usage: CHECK_ANALYTICS <metric> <platform>' };
  }

  if (!config.analyticsMetrics.includes(metric)) {
    return { success: false, message: `Invalid metric '${metric}'. Supported: ${config.analyticsMetrics.join(', ')}` };
  }

  // Simulate analytics data
  const valueMap = {
    pageviews: Math.floor(Math.random() * 50000) + 1000,
    sessions: Math.floor(Math.random() * 20000) + 500,
    bounce_rate: parseFloat((Math.random() * 60 + 20).toFixed(2)),
    avg_duration: parseFloat((Math.random() * 300 + 30).toFixed(1)),
    conversions: Math.floor(Math.random() * 500) + 10,
  };

  const result = {
    metric,
    platform,
    value: valueMap[metric],
    unit: metric === 'bounce_rate' ? '%' : metric === 'avg_duration' ? 'seconds' : 'count',
    period: 'last_30_days',
    checkedAt: new Date().toISOString(),
  };

  // Store analytics snapshot
  db.insert('analytics_snapshots', result);

  logger.info(MODULE, `Analytics '${metric}' on '${platform}': ${result.value}${result.unit === '%' ? '%' : ''} by '${callerUsername}'.`);
  addAuditEntry(callerUsername, 'CHECK_ANALYTICS', MODULE, result);

  return {
    success: true,
    message: `${metric} on ${platform}: ${result.value} ${result.unit} (${result.period}).`,
    data: result,
  };
}

/**
 * CHECK_ADS <campaign_id>
 */
export function checkAds(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [campaignId] = args;
  if (!campaignId) {
    return { success: false, message: 'Usage: CHECK_ADS <campaign_id>' };
  }

  // Simulate ad campaign data
  const impressions = Math.floor(Math.random() * 100000) + 5000;
  const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
  const ctr = parseFloat(((clicks / impressions) * 100).toFixed(2));
  const spend = parseFloat((Math.random() * 5000 + 100).toFixed(2));
  const conversions = Math.floor(clicks * (Math.random() * 0.1 + 0.02));

  const result = {
    campaignId,
    impressions,
    clicks,
    ctr,
    spend,
    currency: 'IDR',
    conversions,
    costPerConversion: conversions > 0 ? parseFloat((spend / conversions).toFixed(2)) : 0,
    status: 'active',
    checkedAt: new Date().toISOString(),
  };

  db.insert('ads_snapshots', result);

  logger.info(MODULE, `Ads campaign '${campaignId}' checked by '${callerUsername}'. CTR: ${ctr}%.`);
  addAuditEntry(callerUsername, 'CHECK_ADS', MODULE, result);

  return {
    success: true,
    message: `Campaign '${campaignId}': ${impressions} impressions, ${clicks} clicks (CTR: ${ctr}%), spend: ${spend} IDR.`,
    data: result,
  };
}

/**
 * CHECK_ADSENSE <site_id>
 */
export function checkAdsense(callerUsername, args) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const [siteId] = args;
  if (!siteId) {
    return { success: false, message: 'Usage: CHECK_ADSENSE <site_id>' };
  }

  // Simulate AdSense data
  const pageViews = Math.floor(Math.random() * 200000) + 10000;
  const adImpressions = Math.floor(pageViews * (Math.random() * 0.8 + 0.5));
  const estimatedEarnings = parseFloat((adImpressions * (Math.random() * 0.005 + 0.001)).toFixed(2));
  const rpm = parseFloat(((estimatedEarnings / pageViews) * 1000).toFixed(2));

  const result = {
    siteId,
    pageViews,
    adImpressions,
    estimatedEarnings,
    currency: 'USD',
    rpm,
    period: 'last_30_days',
    checkedAt: new Date().toISOString(),
  };

  db.insert('adsense_snapshots', result);

  logger.info(MODULE, `AdSense '${siteId}' checked by '${callerUsername}'. Earnings: $${estimatedEarnings}.`);
  addAuditEntry(callerUsername, 'CHECK_ADSENSE', MODULE, result);

  return {
    success: true,
    message: `AdSense '${siteId}': ${pageViews} page views, $${estimatedEarnings} earnings, RPM: $${rpm}.`,
    data: result,
  };
}

/**
 * LIST_METRICS
 */
export function listMetrics(callerUsername) {
  const auth = authorize(callerUsername, ALLOWED_ROLES);
  if (!auth.success) return auth;

  const metrics = config.analyticsMetrics.map((m) => ({
    metric: m,
    description: {
      pageviews: 'Total page views across the site',
      sessions: 'Total user sessions',
      bounce_rate: 'Percentage of single-page sessions',
      avg_duration: 'Average session duration in seconds',
      conversions: 'Total conversion events',
    }[m],
  }));

  addAuditEntry(callerUsername, 'LIST_METRICS', MODULE, { count: metrics.length });

  return {
    success: true,
    message: `${metrics.length} available metric(s).`,
    data: metrics,
  };
}

export default { checkAnalytics, checkAds, checkAdsense, listMetrics };
