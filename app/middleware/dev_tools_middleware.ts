import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'
import app from '@adonisjs/core/services/app'
import env from '#start/env'

export default class DevToolsMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { auth, inertia, session } = ctx
    
    // Check if enabled via .env or if in development mode
    const isEnabled = env.get('ENABLE_DEV_TOOLS') ?? !app.inProduction
    
    // If not enabled at all, skip everything immediately
    if (!isEnabled) {
      return next()
    }

    // Check if user is admin for the UI portion
    if (auth.user?.role !== 'admin') {
      try {
        await auth.use('web').check()
      } catch {}
    }
    
    const user = auth.use('web').user
    const isAdmin = user && user.role === 'admin'
    
    // Terminal logs are for everyone in dev, but UI is admin-only
    // Actually, let's keep the terminal logs strictly to dev mode or if explicitly enabled
    // and UI strictly to admins.
    
    const startTime = process.hrtime()
    const queries: any[] = []

    // Listen for queries
    const queryListener = (query: any) => {
      // SOC2/Security: never collect query bindings in production (often contains PII/secrets).
      const safeQuery = {
        sql: query.sql,
        bindings: app.inProduction ? undefined : query.bindings,
        duration: query.duration,
        timestamp: new Date().toISOString(),
      }
      queries.push({
        ...safeQuery,
      })
    }
    db.emitter.on('db:query', queryListener)

    try {
      // For the UI, we share the metrics of the PREVIOUS request stored in session
      // This is because we can't calculate current request metrics until after it's rendered
      if (isAdmin) {
        const lastMetrics = session.get('devToolsLastMetrics')
        if (lastMetrics) {
          inertia.share({
            devTools: lastMetrics,
          })
        }
      }

      await next()
    } finally {
      db.emitter.off('db:query', queryListener)
      
      const endTime = process.hrtime(startTime)
      const durationMs = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2)
      const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)

      const devToolsData = {
        url: ctx.request.url(),
        method: ctx.request.method(),
        executionTime: durationMs,
        memoryUsage: `${memoryUsage}MB`,
        queries: queries,
        queryCount: queries.length,
        totalQueryDuration: queries.reduce((sum, q) => sum + (q.duration || 0), 0).toFixed(2),
        timestamp: new Date().toISOString(),
      }

      // Log to terminal if enabled
      // SOC2/Security: never log SQL to terminal in production; use admin-only UI (session) instead.
      if (isEnabled && !app.inProduction) {
        const color = queries.length > 20 ? '\x1b[31m' : queries.length > 10 ? '\x1b[33m' : '\x1b[32m'
        const reset = '\x1b[0m'
        const bold = '\x1b[1m'
        const dim = '\x1b[2m'
        
        const summary = [
          `${bold}${color}[DevTools]${reset} ${ctx.request.method()} ${ctx.request.url()}`,
          `${dim}|${reset} Time: ${bold}${durationMs}ms${reset}`,
          `${dim}|${reset} Mem: ${bold}${memoryUsage}MB${reset}`,
          `${dim}|${reset} Q: ${color}${bold}${queries.length}${reset} ${dim}(${devToolsData.totalQueryDuration}ms)${reset}`
        ].join(' ')

        console.log(summary)
        
        // Log slow queries (> 10ms) only if they exist
        queries.filter(q => q.duration > 10).forEach(q => {
          console.log(`  ${dim}└─${reset} \x1b[33mSlow Query (${q.duration.toFixed(2)}ms):${reset} ${dim}${q.sql}${reset}`)
        })
      }

      // Store in session for the next request's UI if admin
      if (isAdmin) {
        session.put('devToolsLastMetrics', devToolsData)
      }
    }
  }
}

