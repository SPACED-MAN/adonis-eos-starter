/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  APP_NAME: Env.schema.string.optional(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  TZ: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring internationalization (i18n)
  |----------------------------------------------------------
  */
  DEFAULT_LOCALE: Env.schema.string.optional(),
  SUPPORTED_LOCALES: Env.schema.string.optional(),

  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Database Pool
  |----------------------------------------------------------
  */
  DB_POOL_MIN: Env.schema.number.optional(),
  DB_POOL_MAX: Env.schema.number.optional(),
  DB_DEBUG: Env.schema.boolean.optional(),

  /*
  |----------------------------------------------------------
  | CMS Configuration
  |----------------------------------------------------------
  */
  CMS_REVISIONS_LIMIT: Env.schema.number.optional(),
  CMS_REVISIONS_AUTO_PRUNE: Env.schema.boolean.optional(),
  CMS_PREVIEW_EXPIRATION_HOURS: Env.schema.number.optional(),
  CMS_PREVIEW_SECRET: Env.schema.string.optional(),
  CMS_SOFT_DELETE_ENABLED: Env.schema.boolean.optional(),
  CMS_SOFT_DELETE_RETENTION_DAYS: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Media
  |----------------------------------------------------------
  */
  MEDIA_UPLOAD_DIR: Env.schema.string.optional(),
  MEDIA_MAX_FILE_SIZE: Env.schema.number.optional(),
  MEDIA_ALLOWED_TYPES: Env.schema.string.optional(),
  MEDIA_DERIVATIVES: Env.schema.string.optional(),
  MEDIA_ADMIN_THUMBNAIL_VARIANT: Env.schema.string.optional(),
  MEDIA_ADMIN_MODAL_VARIANT: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Cache
  |----------------------------------------------------------
  */
  CMS_SSR_CACHE_TTL: Env.schema.number.optional(),
  CMS_PUBLIC_MAX_AGE: Env.schema.number.optional(),
  CMS_CDN_MAX_AGE: Env.schema.number.optional(),
  CMS_SWR: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Rate Limiting
  |----------------------------------------------------------
  */
  CMS_RATE_LIMIT_REQUESTS: Env.schema.number.optional(),
  CMS_RATE_LIMIT_WINDOW: Env.schema.number.optional(),
  CMS_RATE_LIMIT_AUTH_REQUESTS: Env.schema.number.optional(),
  CMS_RATE_LIMIT_AUTH_WINDOW: Env.schema.number.optional(),
  CMS_RATE_LIMIT_API_REQUESTS: Env.schema.number.optional(),
  CMS_RATE_LIMIT_API_WINDOW: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Webhooks
  |----------------------------------------------------------
  */
  CMS_WEBHOOKS_ENABLED: Env.schema.boolean.optional(),
  CMS_WEBHOOK_TIMEOUT: Env.schema.number.optional(),
  CMS_WEBHOOK_MAX_RETRIES: Env.schema.number.optional(),
  CMS_WEBHOOK_SECRET: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Scheduler
  |----------------------------------------------------------
  */
  CMS_SCHEDULER_DEV_INTERVAL: Env.schema.number.optional(),
  CMS_SCHEDULER_PROD_INTERVAL: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | Storage (Cloudflare R2 or Local)
  |----------------------------------------------------------
  */
  STORAGE_DRIVER: Env.schema.string.optional(),
  R2_ACCOUNT_ID: Env.schema.string.optional(),
  R2_ENDPOINT: Env.schema.string.optional(),
  R2_BUCKET: Env.schema.string.optional(),
  R2_ACCESS_KEY_ID: Env.schema.string.optional(),
  R2_SECRET_ACCESS_KEY: Env.schema.string.optional(),
  R2_PUBLIC_BASE_URL: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | AI Provider API Keys
  |----------------------------------------------------------
  */
  AI_PROVIDER_OPENAI_API_KEY: Env.schema.string.optional(),
  AI_PROVIDER_ANTHROPIC_API_KEY: Env.schema.string.optional(),
  AI_PROVIDER_GOOGLE_API_KEY: Env.schema.string.optional(),
  AI_PROVIDER_NANOBANANA_API_KEY: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | MCP System User
  |----------------------------------------------------------
  */
  MCP_SYSTEM_USER_ID: Env.schema.number.optional(),

  /*
  |----------------------------------------------------------
  | CORS Configuration
  |----------------------------------------------------------
  */
  CORS_ORIGINS: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | CSP Configuration
  |----------------------------------------------------------
  */
  CSP_CDN_DOMAINS: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Development Tools
  |----------------------------------------------------------
  */
  ENABLE_DEV_TOOLS: Env.schema.boolean.optional(),
})
