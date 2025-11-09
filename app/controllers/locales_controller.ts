import type { HttpContext } from '@adonisjs/core/http'
import localeService from '#services/locale_service'

/**
 * Controller for managing locales
 */
export default class LocalesController {
  /**
   * GET /api/locales
   * List all configured locales
   */
  async index({ response }: HttpContext) {
    const supportedLocales = localeService.getSupportedLocales()
    const defaultLocale = localeService.getDefaultLocale()

    const locales = supportedLocales.map((locale) => ({
      code: locale,
      isDefault: locale === defaultLocale,
    }))

    return response.json({
      data: locales,
      meta: {
        defaultLocale,
        total: locales.length,
      },
    })
  }

  /**
   * GET /api/locales/:locale
   * Get information about a specific locale
   */
  async show({ params, response }: HttpContext) {
    const { locale } = params
    const localeInfo = localeService.getLocaleInfo(locale)

    if (!localeInfo.isSupported) {
      return response.notFound({
        error: 'Locale not supported',
        code: locale,
      })
    }

    return response.json({
      data: localeInfo,
    })
  }
}

