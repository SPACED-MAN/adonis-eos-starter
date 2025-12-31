import { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import siteSettingsService from '#services/site_settings_service'

/**
 * Reads the theme mode from a plain cookie and shares it with Inertia.
 * This allows the server to know the theme during SSR, preventing flicker.
 */
export default class ThemeMiddleware {
  async handle({ request, inertia }: HttpContext, next: NextFn) {
    const settings = await siteSettingsService.get()
    const themeMode = request.plainCookie('theme-mode') || settings.defaultThemeMode
    inertia.share({
      isDark: themeMode === 'dark',
    })
    return next()
  }
}
