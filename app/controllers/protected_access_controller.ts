import type { HttpContext } from '@adonisjs/core/http'
import siteCustomFieldsService from '#services/site_custom_fields_service'

export default class ProtectedAccessController {
  /**
   * GET /protected
   * Render protected access form (Inertia site page)
   */
  async showForm({ inertia, request }: HttpContext) {
    const redirect = String(request.input('redirect', request.header('referer') || '/'))
    return inertia.render('site/protected', { redirect })
  }

  /**
   * POST /protected/login
   * Body: { username, password, redirect? }
   */
  async login({ request, response }: HttpContext) {
    const username = String(request.input('username', '')).trim()
    const password = String(request.input('password', '')).trim()
    const redirect = String(request.input('redirect', '/')) || '/'

    // Load credentials from site custom fields OR env as fallback
    let expectedUser = ''
    let expectedPass = ''
    try {
      const vals = await siteCustomFieldsService.getValues()
      expectedUser = String((vals as any)?.protected_access_username || '')
      expectedPass = String((vals as any)?.protected_access_password || '')
    } catch { /* ignore */ }
    if (!expectedUser || !expectedPass) {
      expectedUser = process.env.PROTECTED_ACCESS_USERNAME || ''
      expectedPass = process.env.PROTECTED_ACCESS_PASSWORD || ''
    }

    const ok = username && password && expectedUser && expectedPass && username === expectedUser && password === expectedPass
    if (!ok) {
      return response.unauthorized({ error: 'Invalid credentials' })
    }
    // Set a cookie granting access
    response.cookie('PROTECTED_AUTH', '1', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 hours
    })
    return response.ok({ ok: true, redirect })
  }
}



