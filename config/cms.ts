/**
 * CMS Configuration
 *
 * Centralized configuration for all CMS-related settings.
 * Access via: import cmsConfig from '#config/cms'
 */

import env from '#start/env'

const cmsConfig = {
  /**
   * Revision history settings
   */
  revisions: {
    /** Maximum revisions to retain per post (0 = unlimited) */
    limit: env.get('CMS_REVISIONS_LIMIT') ?? 20,
    /** Auto-prune revisions on save */
    autoPrune: env.get('CMS_REVISIONS_AUTO_PRUNE') ?? true,
  },

  /**
   * Preview settings
   */
  preview: {
    /** Preview link expiration in hours */
    linkExpirationHours: env.get('CMS_PREVIEW_EXPIRATION_HOURS') ?? 24,
    /** Secret for signing preview tokens */
    secret: env.get('CMS_PREVIEW_SECRET') ?? env.get('APP_KEY'),
  },

  /**
   * Media settings
   */
  media: {
    /** Upload directory relative to public/ */
    uploadDir: env.get('MEDIA_UPLOAD_DIR') ?? 'uploads',
    /** Maximum file size in bytes (default 10MB) */
    maxFileSize: env.get('MEDIA_MAX_FILE_SIZE') ?? 10 * 1024 * 1024,
    /** Allowed MIME types */
    allowedMimeTypes: (
      env.get('MEDIA_ALLOWED_TYPES') ??
      'image/jpeg,image/png,image/gif,image/webp,image/avif,application/pdf'
    ).split(','),
    /** Image derivative configurations */
    derivatives:
      env.get('MEDIA_DERIVATIVES') ?? 'thumb:200x200_crop,small:400x,medium:800x,large:1600x',
    /** Admin thumbnail variant name */
    adminThumbnailVariant: env.get('MEDIA_ADMIN_THUMBNAIL_VARIANT') ?? 'thumb',
    /** Admin modal variant name */
    adminModalVariant: env.get('MEDIA_ADMIN_MODAL_VARIANT') ?? 'large',
  },

  /**
   * Cache settings
   */
  cache: {
    /** SSR cache TTL in seconds */
    ssrTtl: env.get('CMS_SSR_CACHE_TTL') ?? 3600,
    /** Public page cache control max-age */
    publicMaxAge: env.get('CMS_PUBLIC_MAX_AGE') ?? 60,
    /** CDN s-maxage */
    cdnMaxAge: env.get('CMS_CDN_MAX_AGE') ?? 3600,
    /** Stale-while-revalidate duration */
    staleWhileRevalidate: env.get('CMS_SWR') ?? 604800,
  },

  /**
   * Rate limiting settings
   */
  rateLimit: {
    /** Default requests per window */
    defaultRequests: env.get('CMS_RATE_LIMIT_REQUESTS') ?? 100,
    /** Default window duration in seconds */
    defaultWindow: env.get('CMS_RATE_LIMIT_WINDOW') ?? 60,
    /** Auth endpoint requests per window */
    authRequests: env.get('CMS_RATE_LIMIT_AUTH_REQUESTS') ?? 5,
    /** Auth endpoint window duration */
    authWindow: env.get('CMS_RATE_LIMIT_AUTH_WINDOW') ?? 60,
    /** API endpoint requests per window */
    apiRequests: env.get('CMS_RATE_LIMIT_API_REQUESTS') ?? 120,
    /** API endpoint window duration */
    apiWindow: env.get('CMS_RATE_LIMIT_API_WINDOW') ?? 60,
  },

  /**
   * Soft delete settings
   */
  softDelete: {
    /** Enable soft deletes for posts */
    enabled: env.get('CMS_SOFT_DELETE_ENABLED') ?? true,
    /** Days to retain soft-deleted posts before permanent deletion */
    retentionDays: env.get('CMS_SOFT_DELETE_RETENTION_DAYS') ?? 30,
  },

  /**
   * Webhook settings
   */
  webhooks: {
    /** Enable webhook dispatching */
    enabled: env.get('CMS_WEBHOOKS_ENABLED') ?? false,
    /** Webhook timeout in milliseconds */
    timeout: env.get('CMS_WEBHOOK_TIMEOUT') ?? 5000,
    /** Maximum retry attempts */
    maxRetries: env.get('CMS_WEBHOOK_MAX_RETRIES') ?? 3,
    /** Secret for signing webhook payloads */
    secret: env.get('CMS_WEBHOOK_SECRET') ?? '',
  },

  /**
   * Agent settings (AI assistants)
   */
  agents: {
    /** JSON array of agent configurations */
    config: env.get('CMS_AGENTS') ?? '[]',
  },

  /**
   * Scheduling settings
   */
  scheduling: {
    /** Scheduler check interval in seconds (dev) */
    devInterval: env.get('CMS_SCHEDULER_DEV_INTERVAL') ?? 30,
    /** Scheduler check interval in seconds (prod) */
    prodInterval: env.get('CMS_SCHEDULER_PROD_INTERVAL') ?? 60,
  },

  /**
   * Pagination defaults
   */
  pagination: {
    /** Default page size */
    defaultLimit: 20,
    /** Maximum page size */
    maxLimit: 1000,
  },
}

export default cmsConfig
