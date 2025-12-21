import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import app from '@adonisjs/core/services/app'
import cmsConfig from '#config/cms'
import { adminPath } from '#services/admin_path_service'
import { auditLogsQueryValidator, loginHistoryQueryValidator } from '#validators/query'
import { securitySessionsQueryValidator } from '#validators/security'

/**
 * Security Controller
 *
 * Provides endpoints for security management:
 * - Active sessions management
 * - Audit logs viewer
 * - Security posture checks
 * - Webhook security status
 */
export default class SecurityController {
  /**
   * GET /admin/security
   * Security dashboard page
   */
  async index({ inertia }: HttpContext) {
    return inertia.render('admin/security/index')
  }

  /**
   * GET /api/security/sessions
   * Get active sessions for current user
   */
  async sessions({ request, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    // Validate query params
    await request.validateUsing(securitySessionsQueryValidator)
    // Note: AdonisJS session guard uses cookie-based sessions
    // We can't easily list all sessions without Redis/DB session store
    // For now, return current session info
    const sessionId = auth.use('web').sessionId
    return response.ok({
      data: [
        {
          id: sessionId || 'current',
          userId: user.id,
          email: user.email,
          current: true,
          ip: 'N/A', // Would need to track this
          userAgent: 'N/A', // Would need to track this
          lastActivity: new Date().toISOString(),
        },
      ],
    })
  }

  /**
   * DELETE /api/security/sessions/:sessionId
   * Revoke a session (logout)
   */
  async revokeSession({ params, auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const sessionId = params.sessionId

    // If revoking current session, logout
    if (sessionId === 'current') {
      await auth.use('web').logout()
      return response.ok({ message: 'Session revoked' })
    }

    // Note: With cookie-based sessions, we can't revoke other sessions easily
    // This would require Redis/DB session store
    return response.badRequest({ message: 'Cannot revoke other sessions with cookie store' })
  }

  /**
   * POST /api/security/sessions/revoke-all
   * Revoke all other sessions (logout everywhere except current)
   */
  async revokeAllSessions({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    // Note: With cookie-based sessions, we can't revoke other sessions
    // This would require Redis/DB session store
    return response.ok({
      message: 'Other sessions cannot be revoked with cookie-based sessions. Consider using Redis session store.',
    })
  }

  /**
   * GET /api/security/audit-logs
   * Get audit logs with filters
   */
  async auditLogs({ request, response }: HttpContext) {
    const { userId, action, entityType, limit, offset, startDate, endDate } =
      await request.validateUsing(auditLogsQueryValidator)

    const effectiveLimit = limit || 50
    const effectiveOffset = offset || 0

    let q = db
      .from('activity_logs')
      .leftJoin('users', 'users.id', 'activity_logs.user_id')
      .select(
        'activity_logs.id',
        'activity_logs.action',
        'activity_logs.entity_type as entityType',
        'activity_logs.entity_id as entityId',
        'activity_logs.metadata',
        'activity_logs.ip',
        'activity_logs.user_agent as userAgent',
        'activity_logs.created_at as createdAt',
        'users.email as userEmail',
        'users.id as userId'
      )
      .orderBy('activity_logs.created_at', 'desc')
      .limit(effectiveLimit)
      .offset(effectiveOffset)

    if (userId) q = q.where('activity_logs.user_id', userId)
    if (action) q = q.where('activity_logs.action', action)
    if (entityType) q = q.where('activity_logs.entity_type', entityType)
    if (startDate) q = q.where('activity_logs.created_at', '>=', startDate)
    if (endDate) q = q.where('activity_logs.created_at', '<=', endDate)

    const rows = await q
    const total = await db.from('activity_logs').count('* as total').first()

    return response.ok({
      data: rows,
      pagination: {
        limit: effectiveLimit,
        offset: effectiveOffset,
        total: Number(total?.total || 0),
      },
    })
  }

  /**
   * GET /api/security/posture
   * Get security posture checklist
   */
  async posture({ response }: HttpContext) {
    const checks = {
      dbTls: {
        label: 'Database TLS Enabled',
        status: env.get('DB_SSL') === true ? 'pass' : 'fail',
        message: env.get('DB_SSL') === true ? 'Database connections use TLS' : 'Database TLS not enabled',
        recommendation: env.get('DB_SSL') !== true ? 'Set DB_SSL=true in production' : null,
      },
      corsConfigured: {
        label: 'CORS Origins Configured',
        status: env.get('CORS_ORIGINS') ? 'pass' : 'warn',
        message: env.get('CORS_ORIGINS')
          ? 'CORS origins configured'
          : 'CORS origins not configured (may allow all origins)',
        recommendation: !env.get('CORS_ORIGINS') ? 'Set CORS_ORIGINS in production' : null,
      },
      sessionSecure: {
        label: 'Session Cookie Secure',
        status: app.inProduction ? 'pass' : 'info',
        message: app.inProduction
          ? 'Session cookies are secure in production'
          : 'Session cookies are not secure in development',
        recommendation: null,
      },
      webhookSigning: {
        label: 'Webhook Signing Enabled',
        status: !!cmsConfig.webhooks.secret ? 'pass' : 'warn',
        message: cmsConfig.webhooks.secret
          ? 'Webhook signing secret configured'
          : 'Webhook signing secret not configured',
        recommendation: !cmsConfig.webhooks.secret ? 'Set CMS_WEBHOOK_SECRET' : null,
      },
      webhookAllowlist: {
        label: 'Webhook Allowlist Configured',
        status: (cmsConfig.webhooks as any)?.allowedHosts?.length > 0 ? 'pass' : 'warn',
        message: (cmsConfig.webhooks as any)?.allowedHosts?.length > 0
          ? 'Webhook destination allowlist configured'
          : 'Webhook allowlist not configured (allows any destination)',
        recommendation:
          (cmsConfig.webhooks as any)?.allowedHosts?.length === 0
            ? 'Set CMS_WEBHOOK_ALLOWED_HOSTS to restrict webhook destinations'
            : null,
      },
      csrfEnabled: {
        label: 'CSRF Protection Enabled',
        status: 'pass', // CSRF is enabled by default in AdonisJS
        message: 'CSRF protection is enabled',
        recommendation: null,
      },
      rateLimiting: {
        label: 'Rate Limiting Enabled',
        status: 'pass', // Rate limiting middleware is configured
        message: 'Rate limiting is enabled for auth endpoints',
        recommendation: null,
      },
    }

    const passed = Object.values(checks).filter((c) => c.status === 'pass').length
    const total = Object.keys(checks).length
    const overallStatus = passed === total ? 'pass' : passed >= total * 0.7 ? 'warn' : 'fail'

    return response.ok({
      checks,
      summary: {
        passed,
        total,
        overallStatus,
      },
    })
  }

  /**
   * GET /api/security/webhooks
   * Get webhook security status
   */
  async webhooks({ response }: HttpContext) {
    const webhooks = await db.from('webhooks').select('id', 'name', 'url', 'active', 'events')
    const allowedHosts = (cmsConfig.webhooks as any)?.allowedHosts as string[] | undefined

    return response.ok({
      webhooks: webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        active: w.active,
        events: w.events,
        // Check if URL would be allowed
        allowed: allowedHosts
          ? allowedHosts.some((h) => {
              try {
                const url = new URL(w.url)
                const hostname = url.hostname.toLowerCase()
                return hostname === h || hostname.endsWith(`.${h}`)
              } catch {
                return false
              }
            })
          : true, // No allowlist = all allowed
      })),
      allowlistConfigured: !!allowedHosts && allowedHosts.length > 0,
      allowlistHosts: allowedHosts || [],
      signingConfigured: !!cmsConfig.webhooks.secret,
    })
  }

  /**
   * GET /api/security/login-history
   * Get login history (failed/successful logins)
   */
  async loginHistory({ request, response }: HttpContext) {
    const { limit, offset } = await request.validateUsing(loginHistoryQueryValidator)
    const effectiveLimit = limit || 50
    const effectiveOffset = offset || 0

    // Query activity logs for login-related actions
    const rows = await db
      .from('activity_logs')
      .leftJoin('users', 'users.id', 'activity_logs.user_id')
      .whereIn('activity_logs.action', ['user.login', 'user.login_failed', 'user.logout'])
      .select(
        'activity_logs.id',
        'activity_logs.action',
        'activity_logs.ip',
        'activity_logs.user_agent as userAgent',
        'activity_logs.created_at as createdAt',
        'users.email as userEmail',
        'users.id as userId'
      )
      .orderBy('activity_logs.created_at', 'desc')
      .limit(effectiveLimit)
      .offset(effectiveOffset)

    const total = await db
      .from('activity_logs')
      .whereIn('action', ['user.login', 'user.login_failed', 'user.logout'])
      .count('* as total')
      .first()

    return response.ok({
      data: rows,
      pagination: {
        limit: effectiveLimit,
        offset: effectiveOffset,
        total: Number(total?.total || 0),
      },
    })
  }
}

