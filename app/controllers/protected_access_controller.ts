import type { HttpContext } from '@adonisjs/core/http'
import siteCustomFieldsService from '#services/site_custom_fields_service'
import databaseImportService, { type ImportStrategy } from '#services/database_import_service'
import { readFile } from 'node:fs/promises'

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
    } catch {
      /* ignore */
    }
    if (!expectedUser || !expectedPass) {
      expectedUser = process.env.PROTECTED_ACCESS_USERNAME || ''
      expectedPass = process.env.PROTECTED_ACCESS_PASSWORD || ''
    }

    const ok = !!(
      username &&
      password &&
      expectedUser &&
      expectedPass &&
      username === expectedUser &&
      password === expectedPass
    )
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

  /**
   * POST /protected/import
   * Public-but-protected import for fresh installs.
   * Requires protected access credentials (username/password) or valid session.
   */
  async import({ request, response }: HttpContext) {
    const username = String(request.input('username', '')).trim()
    const password = String(request.input('password', '')).trim()

    // 1. Validate credentials OR session
    let authenticated = request.cookie('PROTECTED_AUTH') === '1'

    if (!authenticated) {
      let expectedUser = ''
      let expectedPass = ''
      try {
        const vals = await siteCustomFieldsService.getValues()
        expectedUser = String((vals as any)?.protected_access_username || '')
        expectedPass = String((vals as any)?.protected_access_password || '')
      } catch {
        /* ignore */
      }
      if (!expectedUser || !expectedPass) {
        expectedUser = process.env.PROTECTED_ACCESS_USERNAME || ''
        expectedPass = process.env.PROTECTED_ACCESS_PASSWORD || ''
      }

      authenticated = !!(
        username &&
        password &&
        expectedUser &&
        expectedPass &&
        username === expectedUser &&
        password === expectedPass
      )
    }

    if (!authenticated) {
      return response.unauthorized({ error: 'Invalid credentials' })
    }

    // 2. Perform Import
    try {
      const file = request.file('file', {
        size: '100mb',
        extnames: ['json'],
      })

      if (!file) {
        return response.badRequest({ error: 'No file uploaded' })
      }

      if (!file.isValid) {
        return response.badRequest({ error: file.errors[0]?.message || 'Invalid file' })
      }

      if (!file.tmpPath) {
        return response.badRequest({ error: 'File upload failed' })
      }

      const strategy = (request.input('strategy') as ImportStrategy) || 'merge'
      const preserveIds = request.input('preserveIds', 'true') === 'true'

      const content = await readFile(file.tmpPath)
      const result = await databaseImportService.importFromBuffer(content, {
        strategy,
        preserveIds,
        disableForeignKeyChecks: true,
      })

      if (result.success) {
        return response.ok({ result })
      } else {
        return response.badRequest({ error: 'Import failed', result })
      }
    } catch (error: any) {
      console.error('[ProtectedImport] Import failed:', error)
      return response.internalServerError({ error: error.message || 'Import failed' })
    }
  }
}
