import type { HttpContext } from '@adonisjs/core/http'
import localeService from '#services/locale_service'
import db from '@adonisjs/lucid/services/db'
import { updateLocaleValidator } from '#validators/locale'
import roleRegistry from '#services/role_registry'

/**
 * Controller for managing locales
 */
export default class LocalesController {
  /**
   * GET /api/locales
   * List all configured locales
   */
  async index({ response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.view')) {
      return response.forbidden({ error: 'Not allowed to view locales' })
    }
    await localeService.ensureFromEnv()
    const rows = await db.from('locales').select('*').orderBy('code', 'asc')
    const defaultLocale = rows.find((r) => r.is_default)?.code

    return response.json({
      data: rows.map((r) => ({ code: r.code, isDefault: r.is_default, isEnabled: r.is_enabled })),
      meta: {
        defaultLocale: defaultLocale || 'en',
        total: rows.length,
      },
    })
  }

  /**
   * GET /api/locales/:locale
   * Get information about a specific locale
   */
  async show({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.view')) {
      return response.forbidden({ error: 'Not allowed to view locale details' })
    }
    const { locale } = params
    const row = await db.from('locales').where('code', locale.toLowerCase()).first()
    if (!row) {
      return response.notFound({ error: 'Locale not found', code: locale })
    }
    return response.json({
      data: { code: row.code, isDefault: row.is_default, isEnabled: row.is_enabled },
    })
  }

  /**
   * PATCH /api/locales/:locale
   * Body: { isEnabled?: boolean, isDefault?: boolean }
   */
  async update({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to update locales' })
    }
    const { locale } = params
    const { isEnabled, isDefault } = await request.validateUsing(updateLocaleValidator)
    const code = String(locale).toLowerCase()
    const row = await db.from('locales').where('code', code).first()
    if (!row) {
      return response.notFound({ error: 'Locale not found' })
    }
    const updates: Record<string, any> = { updated_at: new Date() }
    if (typeof isEnabled === 'boolean') {
      updates.is_enabled = isEnabled
      if (isEnabled === false) {
        // Archive posts when disabling this locale
        await db
          .from('posts')
          .where('locale', code)
          .update({ status: 'archived', updated_at: new Date() })
      }
    }
    if (typeof isDefault === 'boolean') {
      if (isDefault) {
        await db.from('locales').update({ is_default: false })
        updates.is_default = true
      } else {
        // Prevent unsetting default on the current default
        if (row.is_default) {
          return response.badRequest({
            error: 'Cannot unset default locale. Set another locale as default instead.',
          })
        }
      }
    }
    const [updated] = await db.from('locales').where('code', code).update(updates).returning('*')
    return response.ok({ data: updated, message: 'Locale updated' })
  }

  /**
   * DELETE /api/locales/:locale
   * Deletes the locale and cascades posts (via FK)
   */
  async destroy({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'admin.settings.update')) {
      return response.forbidden({ error: 'Not allowed to delete locales' })
    }
    const { locale } = params
    const code = String(locale).toLowerCase()
    const row = await db.from('locales').where('code', code).first()
    if (!row) {
      return response.notFound({ error: 'Locale not found' })
    }
    if (row.is_default) {
      return response.badRequest({ error: 'Cannot delete the default locale' })
    }
    await db.from('locales').where('code', code).delete()
    return response.noContent()
  }
}
