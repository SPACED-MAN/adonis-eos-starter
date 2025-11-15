import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class PatternsController {
  async index({ response }: HttpContext) {
    const patterns = await db.from('url_patterns').select('*')
    return response.ok({ data: patterns })
  }

  async upsert({ params, request, response }: HttpContext) {
    const { locale } = params
    const { pattern } = request.only(['pattern'])
    if (!pattern || typeof pattern !== 'string') {
      return response.badRequest({ error: 'pattern is required' })
    }
    if (!pattern.includes(':slug')) {
      return response.badRequest({ error: 'pattern must include :slug token' })
    }
    // :locale is optional; when omitted, URLs won’t include the locale segment
    await db
      .table('url_patterns')
      .insert({ locale, pattern })
      .onConflict('locale')
      .merge({ pattern, updated_at: new Date() })
    return response.ok({ data: { locale, pattern } })
  }
}


