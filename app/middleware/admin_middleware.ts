import type { HttpContext } from '@adonisjs/core/http'
import roleRegistry from '#services/role_registry'

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    await ctx.auth
      .use('web')
      .check()
      .catch(() => {})
    const user = ctx.auth.use('web').user
    if (!user || !roleRegistry.hasPermission((user as any).role, 'admin.access')) {
      const isInertia = !!ctx.request.header('x-inertia')
      if (isInertia) {
        // For Inertia navigations, redirect to a graceful forbidden page
        return ctx.response.redirect('/admin/forbidden')
      }
      // Fallback for non-Inertia/API requests
      return ctx.response.forbidden({ error: 'Admin access required' })
    }
    await next()
  }
}
