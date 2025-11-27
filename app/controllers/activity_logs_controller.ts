import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class ActivityLogsController {
  /**
   * GET /api/activity-logs?userId=&action=&limit=&offset=
   * Admin-only
   */
  async index({ request, response }: HttpContext) {
    const userId = request.input('userId')
    const action = request.input('action')
    const limit = Math.min(Number(request.input('limit') || 50), 200)
    const offset = Math.max(Number(request.input('offset') || 0), 0)
    let q = db.from('activity_logs')
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
        'users.id as userId',
      )
      .orderBy('activity_logs.created_at', 'desc')
      .limit(limit)
      .offset(offset)
    if (userId) q = q.where('activity_logs.user_id', userId)
    if (action) q = q.where('activity_logs.action', String(action))
    const rows = await q
    return response.ok({ data: rows })
  }
}



