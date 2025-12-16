import { defineConfig } from '@adonisjs/cors'
import env from '#start/env'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 *
 * IMPORTANT: In production, configure allowed origins via CORS_ORIGINS
 * environment variable (comma-separated list of domains).
 * Example: CORS_ORIGINS=https://example.com,https://www.example.com
 */
const corsOrigins = env.get('CORS_ORIGINS', '')
  ? env.get('CORS_ORIGINS', '').split(',').map((o) => o.trim()).filter(Boolean)
  : []

const corsConfig = defineConfig({
  enabled: true,
  origin: corsOrigins.length > 0 ? corsOrigins : true, // Allow all in dev, restrict in prod
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
