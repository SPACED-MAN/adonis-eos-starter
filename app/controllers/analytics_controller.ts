import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import urlPatternService from '#services/url_pattern_service'
import cmsConfig from '#config/cms'

export default class AnalyticsController {
  /**
   * POST /api/public/analytics/track
   * Tracking endpoint for public site
   */
  async track({ request, response }: HttpContext) {
    if (!cmsConfig.features.analytics) {
      return response.noContent()
    }
    const payload = request.body()
    const events = Array.isArray(payload) ? payload : [payload]

    // Batch insert for performance
    const toInsert = events.map((event) => ({
      post_id: event.postId || null,
      event_type: event.eventType,
      x: event.x != null ? Number(event.x) : null,
      y: event.y != null ? Number(event.y) : null,
      viewport_width: event.viewportWidth != null ? Number(event.viewportWidth) : null,
      metadata: event.metadata || null,
      created_at: new Date(),
    }))

    if (toInsert.length > 0) {
      try {
        await db.table('analytics_events').insert(toInsert)
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Analytics] Logged ${toInsert.length} events`)
        }
      } catch (e) {
        console.error('[Analytics] Failed to insert events:', e)
      }
    }

    return response.noContent()
  }

  /**
   * GET /api/analytics/summary
   * Analytics summary for admin panel
   */
  async getSummary({ response }: HttpContext) {
    if (!cmsConfig.features.analytics) {
      return response.ok({
        summary: { totalViews: 0, totalClicks: 0 },
        topPosts: [],
        statsOverTime: [],
      })
    }
    const views = await db
      .from('analytics_events')
      .where('event_type', 'view')
      .count('* as count')
      .first()

    const clicks = await db
      .from('analytics_events')
      .where('event_type', 'click')
      .count('* as count')
      .first()

    const topPosts = await db
      .from('analytics_events')
      .join('posts', 'posts.id', 'analytics_events.post_id')
      .where('event_type', 'view')
      .select('posts.id', 'posts.title', 'posts.slug')
      .count('analytics_events.id as views')
      .groupBy('posts.id', 'posts.title', 'posts.slug')
      .orderBy('views', 'desc')
      .limit(10)

    const postsWithPaths = await Promise.all(
      topPosts.map(async (p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        views: Number(p.views),
        publicPath: await urlPatternService.buildPostPathForPost(p.id),
      }))
    )

    // Stats over time (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const statsOverTime = await db
      .from('analytics_events')
      .where('created_at', '>=', thirtyDaysAgo)
      .select(db.raw('DATE(created_at) as date'))
      .select(db.raw("COUNT(*) FILTER (WHERE event_type = 'view') as views"))
      .select(db.raw("COUNT(*) FILTER (WHERE event_type = 'click') as clicks"))
      .groupBy('date')
      .orderBy('date', 'asc')

    return response.ok({
      summary: {
        totalViews: Number(views?.count || 0),
        totalClicks: Number(clicks?.count || 0),
      },
      topPosts: postsWithPaths,
      statsOverTime: statsOverTime.map((s) => ({
        date: s.date,
        views: Number(s.views),
        clicks: Number(s.clicks),
      })),
    })
  }

  /**
   * GET /api/analytics/heatmap
   * Heatmap data for a specific post
   */
  async getHeatmapData({ request, response }: HttpContext) {
    if (!cmsConfig.features.analytics) {
      return response.ok({ data: [] })
    }
    const postId = request.input('postId')
    const eventType = request.input('eventType', 'click')

    let query = db.from('analytics_events').where('event_type', eventType)

    if (postId) {
      query = query.where('post_id', postId)
    }

    const data = await query
      .select('x', 'y', 'viewport_width', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(5000)

    return response.ok({ data })
  }
}
