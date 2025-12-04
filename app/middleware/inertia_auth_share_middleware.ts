import type { HttpContext } from '@adonisjs/core/http'
import roleRegistry from '#services/role_registry'

export default class InertiaAuthShareMiddleware {
  async handle(ctx: HttpContext, next: () => Promise<void>) {
    const inertia = (ctx as any).inertia
    if (inertia) {
      // Ensure auth state is evaluated for this request
      try {
        await ctx.auth.use('web').check()
      } catch { }
      const user = ctx.auth.use('web').user
      const sharedUser = user
        ? {
          id: (user as any).id,
          email: (user as any).email,
          fullName: (user as any).fullName || null,
          role: (user as any).role || 'editor',
        }
        : null

      // Get permissions for the current user's role
      const userRole = sharedUser?.role || null
      const roleDefinition = userRole ? roleRegistry.get(userRole) : null
      const permissions = roleDefinition?.permissions || []

      // Get all role definitions for UI dropdowns
      const roles = roleRegistry.list().map((r) => ({
        name: r.name,
        label: r.label,
        description: r.description || null,
      }))

      inertia.share({
        currentUser: sharedUser,
        auth: { user: sharedUser },
        isAdmin: !!(sharedUser && sharedUser.role === 'admin'),
        permissions, // Share permissions array with frontend
        roles, // Share role definitions with frontend
        mediaAdmin: {
          thumbnailVariant: process.env.MEDIA_ADMIN_THUMBNAIL_VARIANT || null,
          modalVariant: process.env.MEDIA_ADMIN_MODAL_VARIANT || null,
        },
      })
    }
    await next()
  }
}
