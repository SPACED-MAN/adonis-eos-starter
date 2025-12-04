import type { HttpContext } from '@adonisjs/core/http'

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    await ctx.auth
      .use('web')
      .check()
      .catch(() => {})
    const user = ctx.auth.use('web').user
    if (!user || (user as any).role !== 'admin') {
      const isInertia = !!ctx.request.header('x-inertia')
      if (isInertia) {
        // For Inertia navigations, redirect to a graceful forbidden page
        return ctx.response.redirect('/admin/forbidden')
      }
      // Fallback for non-Inertia/API requests
      return ctx.response.forbidden({ error: 'Admin role required' })
    }
    await next()
  }
}
