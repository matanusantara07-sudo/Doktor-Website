/**
 * Configuration management for Doktor-Website.
 * Centralizes all configurable values with sensible defaults.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const config = {
  /** Absolute path to project root */
  rootDir: ROOT_DIR,

  /** Directory for JSON data store files */
  dataDir: path.join(ROOT_DIR, 'data'),

  /** Directory for exported logs */
  exportDir: path.join(ROOT_DIR, 'exports'),

  /** Directory for application logs */
  logsDir: path.join(ROOT_DIR, 'logs'),

  /** Role hierarchy — higher index = more privilege */
  roles: ['Reporter', 'Redaktur', 'Pemred', 'Admin_Teknis'],

  /** Default password assigned on user creation / reset */
  defaultPassword: 'changeme123',

  /** Supported social media platforms */
  socialPlatforms: ['twitter', 'facebook', 'instagram', 'linkedin', 'tiktok'],

  /** WordPress default REST API path */
  wpApiPath: '/wp-json/wp/v2',

  /** Monitoring ping timeout in milliseconds */
  pingTimeoutMs: 5000,

  /** Supported alert types */
  alertTypes: ['email', 'sms', 'webhook', 'telegram', 'whatsapp'],

  /** Supported analytics metrics */
  analyticsMetrics: ['pageviews', 'sessions', 'bounce_rate', 'avg_duration', 'conversions'],

  /** Supported export formats for audit logs */
  exportFormats: ['json', 'csv', 'txt'],

  /** Draft statuses in workflow order */
  draftStatuses: ['draft', 'submitted', 'in_review', 'approved', 'rejected', 'published'],

  /** Emergency operation modes */
  emergencyModes: ['OBSERVE_ONLY', 'SEMI_AUTOMATION'],

  /** Default emergency mode */
  emergencyMode: 'SEMI_AUTOMATION',
};

export default config;
