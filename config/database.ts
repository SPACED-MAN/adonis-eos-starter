import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

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
      },
      /**
       * Connection pool settings for better performance
       */
      pool: {
        min: Number(env.get('DB_POOL_MIN', 2)),
        max: Number(env.get('DB_POOL_MAX', 10)),
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
      },
      /**
       * Health check settings
       */
      healthCheck: true,
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
