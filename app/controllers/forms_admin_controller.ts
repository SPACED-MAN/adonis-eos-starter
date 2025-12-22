import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import roleRegistry from '#services/role_registry'
import formRegistry from '#services/form_registry'
import { generateCsv } from '../helpers/csv.js'
import { DateTime } from 'luxon'

export default class FormsAdminController {
  /**
   * GET /admin/forms
   * Admin view for listing all submissions across all code-first forms.
   */
  async index({ inertia, auth, request, response }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'forms.view')) {
      return response.redirect('/admin/forbidden')
    }

    const q = request.input('q', '').trim()
    const formSlug = request.input('form_slug', '').trim()
    const page = Number(request.input('page', 1))
    const limit = Number(request.input('limit', 20))

    const query = db.from('form_submissions')

    if (formSlug) {
      query.where('form_slug', formSlug)
    }

    if (q) {
      // Postgres-specific ILIKE for JSONB search or cast to text
      // For cross-DB compatibility, we cast payload to text and search
      query.where((builder) => {
        builder
          .where('form_slug', 'LIKE', `%${q}%`)
          .orWhereRaw('CAST(payload AS TEXT) LIKE ?', [`%${q}%`])
      })
    }

    const totalResult = await query.clone().count('* as total').first()
    const total = Number(totalResult?.total || 0)

    const submissionRows = await query
      .orderBy('created_at', 'desc')
      .offset((page - 1) * limit)
      .limit(limit)
      .select('id', 'form_slug', 'payload', 'created_at', 'ab_variation', 'ab_group_id')

    const submissions = submissionRows.map((r) => {
      const payload = r.payload || {}
      // Common heuristic: find 'email' or 'name' in payload for easy identification in list
      const name = payload.name || payload.first_name || null
      const email = payload.email || null
      
      return {
        id: String(r.id),
        formSlug: String(r.form_slug),
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        name,
        email,
        payload,
        abVariation: r.ab_variation ? String(r.ab_variation) : null,
        abGroupId: r.ab_group_id ? String(r.ab_group_id) : null,
      }
    })

    const forms = formRegistry.list().map((f) => ({
      slug: f.slug,
      title: f.title,
    }))

    return inertia.render('admin/forms/index', {
      submissions,
      forms,
      meta: {
        total,
        page,
        limit,
        q,
        formSlug,
      },
    })
  }

  /**
   * GET /api/forms-submissions/export
   * Export submissions to CSV
   */
  async exportCsv({ auth, request, response }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'forms.view')) {
      return response.forbidden({ error: 'Not allowed to export submissions' })
    }

    const q = request.input('q', '').trim()
    const formSlug = request.input('form_slug', '').trim()

    const query = db.from('form_submissions')

    if (formSlug) {
      query.where('form_slug', formSlug)
    }

    if (q) {
      query.where((builder) => {
        builder
          .where('form_slug', 'LIKE', `%${q}%`)
          .orWhereRaw('CAST(payload AS TEXT) LIKE ?', [`%${q}%`])
      })
    }

    const rows = await query.orderBy('created_at', 'desc').select('*')

    // Find all unique keys across all payloads to build headers
    const allKeys = new Set<string>([
      'id',
      'form_slug',
      'created_at',
      'ip_address',
      'ab_variation',
      'ab_group_id',
    ])
    rows.forEach((r) => {
      const payload = r.payload || {}
      Object.keys(payload).forEach((k) => allKeys.add(`field:${k}`))
    })

    const headers = Array.from(allKeys)
    const csvData = rows.map((r) => {
      const payload = r.payload || {}
      return headers.map((h) => {
        if (h === 'id') return r.id
        if (h === 'form_slug') return r.form_slug
        if (h === 'created_at') return r.created_at
        if (h === 'ip_address') return r.ip_address
        if (h === 'ab_variation') return r.ab_variation
        if (h === 'ab_group_id') return r.ab_group_id
        if (h.startsWith('field:')) {
          const key = h.replace('field:', '')
          const val = payload[key]
          return typeof val === 'object' ? JSON.stringify(val) : val
        }
        return ''
      })
    })

    const csv = generateCsv(headers, csvData)
    const filename = `form-submissions-${DateTime.now().toFormat('yyyy-MM-dd-HHmmss')}.csv`

    response.header('Content-Type', 'text/csv')
    response.header('Content-Disposition', `attachment; filename="${filename}"`)
    return response.send(csv)
  }

  /**
   * GET /api/forms-definitions
   * List all code-first form definitions (admin helper).
   */
  async listDefinitions({ response }: HttpContext) {
    return response.ok({ data: formRegistry.list() })
  }

  /**
   * DELETE /api/forms-submissions/:id
   */
  async deleteSubmission({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'forms.delete')) {
      return response.forbidden({ error: 'Not allowed to delete submissions' })
    }

    const { id } = params
    await db.from('form_submissions').where('id', id).delete()
    return response.noContent()
  }

  /**
   * POST /api/forms-submissions/bulk-delete
   */
  async bulkDelete({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role
    if (!roleRegistry.hasPermission(role, 'forms.delete')) {
      return response.forbidden({ error: 'Not allowed to delete submissions' })
    }

    const { ids } = request.only(['ids']) as { ids: string[] }
    if (!Array.isArray(ids) || ids.length === 0) {
      return response.badRequest({ error: 'No IDs provided' })
    }

    await db.from('form_submissions').whereIn('id', ids).delete()
    return response.ok({ message: `Deleted ${ids.length} submissions` })
  }
}
