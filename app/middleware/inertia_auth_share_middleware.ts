import type { HttpContext } from '@adonisjs/core/http'

export default class InertiaAuthShareMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const inertia = (ctx as any).inertia
    if (inertia) {
      // Ensure auth state is evaluated for this request
      try {
        await ctx.auth.use('web').check()
      } catch {}
      const user = ctx.auth.use('web').user
      const sharedUser = user
        ? {
            id: (user as any).id,
            email: (user as any).email,
            fullName: (user as any).fullName || null,
            role: (user as any).role || 'editor',
          }
        : null
      inertia.share({
        currentUser: sharedUser,
        auth: { user: sharedUser },
        isAdmin: !!(sharedUser && sharedUser.role === 'admin'),
        mediaAdmin: {
          thumbnailVariant: process.env.MEDIA_ADMIN_THUMBNAIL_VARIANT || null,
          modalVariant: process.env.MEDIA_ADMIN_MODAL_VARIANT || null,
        },
      })
    }
    await next()
  }
}
