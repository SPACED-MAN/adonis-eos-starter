import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import siteSettingsService from '#services/site_settings_service'
import { adminPath } from '#services/admin_path_service'

export default class MaintenanceMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const { request, response, auth, inertia } = ctx

    // Always allow admin routes
    const path = request.url()
    if (
      path.startsWith(adminPath()) ||
      path.startsWith('/api/database') ||
      path.startsWith('/api/site-settings')
    ) {
      return next()
    }

    // Always allow login/logout
    if (path.startsWith(adminPath('login')) || path.startsWith(adminPath('logout'))) {
      return next()
    }

    // Check maintenance mode
    const settings = await siteSettingsService.get()
    if (settings.isMaintenanceMode) {
      const isAuthenticated = await auth.use('web').check()
      if (isAuthenticated) {
        const user = auth.use('web').user as any
        if (user.role === 'admin' || user.role === 'editor') {
          return next()
        }
      }

      return response.send(
        await inertia.render('site/MaintenanceMode', {
          siteTitle: settings.siteTitle,
        })
      )
    }

    return next()

    return next()
  }
}
