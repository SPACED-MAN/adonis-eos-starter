import type { HttpContext } from '@adonisjs/core/http'
import Post from '#models/post'
import roleRegistry from '#services/role_registry'
import sitemapService from '#services/sitemap_service'
import cmsConfig from '#config/cms'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import app from '@adonisjs/core/services/app'

export default class DashboardController {
  async index({ inertia, auth, request }: HttpContext) {
    const user = auth.use('web').user
    const role = (user as any)?.role

    // 1. Recent Posts (Base functionality)
    const posts = await Post.query().orderBy('updated_at', 'desc').limit(5)
    const recentPosts = posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      locale: p.locale,
      updatedAt: p.updatedAt.toISO(),
    }))

    const widgets: any[] = []

    // 2. SEO Widget
    if (roleRegistry.hasPermission(role, 'admin.settings.view')) {
      const protocol = request.protocol() || 'https'
      const host = request.host() || request.hostname()
      const cacheKey = `${protocol}://${host}`
      const lastBuiltAt = sitemapService.getLastBuiltAt(cacheKey)
      widgets.push({
        type: 'seo',
        title: 'SEO Overview',
        data: {
          sitemapUrl: `${protocol}://${host}/sitemap.xml`,
          lastBuiltAt: lastBuiltAt ? new Date(lastBuiltAt).toISOString() : null,
        },
      })
    }

    // 3. Analytics Widget
    if (cmsConfig.features.analytics && roleRegistry.hasPermission(role, 'admin.access')) {
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

      widgets.push({
        type: 'analytics',
        title: 'Analytics Summary',
        data: {
          totalViews: Number(views?.count || 0),
          totalClicks: Number(clicks?.count || 0),
        },
      })
    }

    // 4. Security Widget
    if (roleRegistry.hasPermission(role, 'admin.access') && (user as any)?.role === 'admin') {
      const passed = [
        env.get('DB_SSL') === true,
        !!env.get('CORS_ORIGINS'),
        app.inProduction,
        !!cmsConfig.webhooks.secret,
      ].filter(Boolean).length
      const total = 4

      widgets.push({
        type: 'security',
        title: 'Security Posture',
        data: {
          passed,
          total,
          status: passed === total ? 'pass' : passed >= total * 0.7 ? 'warn' : 'fail',
        },
      })
    }

    // 5. Media Widget
    if (roleRegistry.hasPermission(role, 'media.view')) {
      const mediaCount = await db.from('media_assets').count('* as count').first()
      widgets.push({
        type: 'media',
        title: 'Media Library',
        data: {
          totalFiles: Number(mediaCount?.count || 0),
        },
      })
    }

    // 6. Forms Widget
    if (roleRegistry.hasPermission(role, 'forms.view')) {
      const submissionCount = await db.from('form_submissions').count('* as count').first()
      const recentSubmissions = await db
        .from('form_submissions')
        .orderBy('created_at', 'desc')
        .limit(3)

      widgets.push({
        type: 'forms',
        title: 'Recent Submissions',
        data: {
          totalSubmissions: Number(submissionCount?.count || 0),
          recent: recentSubmissions.map((s) => ({
            id: s.id,
            formSlug: s.form_slug,
            createdAt: s.created_at,
          })),
        },
      })
    }

    return inertia.render('admin/home', {
      recentPosts,
      widgets,
    })
  }
}

