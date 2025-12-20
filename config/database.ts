import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'
import app from '@adonisjs/core/services/app'

function buildPostgresSslConfig() {
  const enabled = env.get('DB_SSL', false)
  if (!enabled) return undefined
  const rejectUnauthorized = env.get('DB_SSL_REJECT_UNAUTHORIZED', true)
  const ca = env.get('DB_SSL_CA')
  const ssl: Record<string, any> = { rejectUnauthorized }
  if (ca) ssl.ca = ca
  return ssl
}

const postgresSsl = buildPostgresSslConfig()
const dbHost = env.get('DB_HOST')
const allowInsecure = env.get('DB_SSL_ALLOW_INSECURE', false)
const isLocalDbHost =
  dbHost === 'localhost' || dbHost === '127.0.0.1' || dbHost === '::1' || dbHost.endsWith('.local')

// SOC2/Security: require TLS for non-local databases in production unless explicitly overridden.
if (app.inProduction && !postgresSsl && !allowInsecure && !isLocalDbHost) {
  throw new Error(
    'DB_SSL must be enabled in production for non-local databases. Set DB_SSL=true (recommended) or DB_SSL_ALLOW_INSECURE=true (not recommended).'
  )
}

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
        ...(postgresSsl ? { ssl: postgresSsl } : {}),
      },
      /**
       * Connection pool settings for better performance
       */
      pool: {
        min: Number(env.get('DB_POOL_MIN', 2)),
        max: Number(env.get('DB_POOL_MAX', 10)),
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 5000,
        reapIntervalMillis: 1000,
        createTimeoutMillis: 30000,
      },
      /**
       * Debug mode (enable in development)
       */
      debug: env.get('DB_DEBUG', false),
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
