import { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Reads the theme mode from a plain cookie and shares it with Inertia.
 * This allows the server to know the theme during SSR, preventing flicker.
 */
export default class ThemeMiddleware {
  async handle({ request, inertia }: HttpContext, next: NextFn) {
    const themeMode = request.plainCookie('theme-mode') || 'light'
    inertia.share({
      isDark: themeMode === 'dark',
    })
    return next()
  }
}
