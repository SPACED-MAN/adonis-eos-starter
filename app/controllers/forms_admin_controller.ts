import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import roleRegistry from '#services/role_registry'
import formRegistry from '#services/form_registry'

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

    const submissionRows = await db
      .from('form_submissions')
      .orderBy('created_at', 'desc')
      .limit(200)
      .select('id', 'form_slug', 'payload', 'created_at')

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
      }
    })

    const forms = formRegistry.list().map(f => ({
      slug: f.slug,
      title: f.title
    }))

    return inertia.render('admin/forms/index', { submissions, forms })
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
}
