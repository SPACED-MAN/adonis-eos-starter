import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import localeService from '#services/locale_service'

/**
 * Locale middleware detects and sets the current locale for each request
 */
export default class LocaleMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // Detect locale from request
    const detectedLocale = await localeService.detectLocale(ctx)

    // Store locale in context for use throughout the request
    ctx.locale = detectedLocale

    // Store locale in session for persistence
    await localeService.storeLocaleInSession(ctx, detectedLocale)

    // Continue to next middleware/controller
    return next()
  }
}

// Extend HttpContext to include locale property
declare module '@adonisjs/core/http' {
  interface HttpContext {
    locale: string
  }
}
