import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import roleRegistry from '#services/role_registry'

export default class FormsAdminController {
  /**
   * GET /admin/forms
   * Admin view for managing form definitions and recent submissions.
   */
  async index({ inertia, auth, request, response }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'forms.view')) {
      const isInertia = !!request.header('x-inertia')
      if (isInertia) {
        return response.redirect('/admin/forbidden')
      }
      return response.forbidden({ error: 'Not allowed to view forms' })
    }

    const formRows = await db.from('forms').orderBy('created_at', 'desc')

    const forms = (formRows as any[]).map((r) => ({
      id: String((r as any).id),
      slug: String((r as any).slug),
      title: String((r as any).title),
      description: (r as any).description ? String((r as any).description) : '',
      fields: Array.isArray((r as any).fields_json) ? (r as any).fields_json : [],
      successMessage: (r as any).success_message ? String((r as any).success_message) : '',
      thankYouPostId: (r as any).thank_you_post_id ? String((r as any).thank_you_post_id) : '',
      subscriptions: Array.isArray((r as any).subscriptions_json)
        ? (r as any).subscriptions_json
        : [],
      createdAt: (r as any).created_at ? new Date((r as any).created_at).toISOString() : null,
      updatedAt: (r as any).updated_at ? new Date((r as any).updated_at).toISOString() : null,
    }))

    const submissionRows = await db
      .from('form_submissions')
      .orderBy('created_at', 'desc')
      .limit(100)
      .select('id', 'form_slug', 'payload', 'created_at')

    const submissions = (submissionRows as any[]).map((r) => {
      const payload = (r as any).payload || {}
      const name = typeof payload.name === 'string' ? payload.name : null
      const email = typeof payload.email === 'string' ? payload.email : null
      return {
        id: String((r as any).id),
        formSlug: String((r as any).form_slug),
        createdAt: (r as any).created_at ? new Date((r as any).created_at).toISOString() : null,
        name,
        email,
      }
    })

    return inertia.render('admin/forms/index', { forms, submissions })
  }

  /**
   * GET /api/forms-definitions
   * List all form definitions (admin).
   */
  async listDefinitions({ response }: HttpContext) {
    const rows = await db.from('forms').orderBy('created_at', 'desc')
    const forms = (rows as any[]).map((r) => ({
      id: String((r as any).id),
      slug: String((r as any).slug),
      title: String((r as any).title),
      description: (r as any).description ? String((r as any).description) : '',
      fields: Array.isArray((r as any).fields_json) ? (r as any).fields_json : [],
      successMessage: (r as any).success_message ? String((r as any).success_message) : '',
      thankYouPostId: (r as any).thank_you_post_id ? String((r as any).thank_you_post_id) : '',
      subscriptions: Array.isArray((r as any).subscriptions_json)
        ? (r as any).subscriptions_json
        : [],
      createdAt: (r as any).created_at ? new Date((r as any).created_at).toISOString() : null,
      updatedAt: (r as any).updated_at ? new Date((r as any).updated_at).toISOString() : null,
    }))
    return response.ok({ data: forms })
  }

  /**
   * POST /api/forms-definitions
   * Create a new form definition.
   */
  async createDefinition({ request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'forms.edit')) {
      return response.forbidden({ error: 'Not allowed to create forms' })
    }

    const slugRaw = request.input('slug')
    const titleRaw = request.input('title')
    const descriptionRaw = request.input('description')
    const fieldsRaw = request.input('fields')
    const subscriptionsRaw = request.input('subscriptions')
    const successMessageRaw = request.input('successMessage')
    const thankYouPostIdRaw = request.input('thankYouPostId')

    const slug = String(slugRaw || '').trim()
    const title = String(titleRaw || '').trim()
    const description =
      descriptionRaw !== undefined && descriptionRaw !== null ? String(descriptionRaw) : ''
    const fields = Array.isArray(fieldsRaw) ? fieldsRaw : []
    const subscriptions = Array.isArray(subscriptionsRaw) ? subscriptionsRaw : []
    const successMessage =
      successMessageRaw !== undefined && successMessageRaw !== null ? String(successMessageRaw) : ''
    const thankYouPostId =
      thankYouPostIdRaw !== undefined &&
        thankYouPostIdRaw !== null &&
        String(thankYouPostIdRaw).trim() !== ''
        ? String(thankYouPostIdRaw)
        : ''

    if (!slug || !title) {
      return response.badRequest({ error: 'slug and title are required' })
    }

    const now = new Date()

    const [row] = await db
      .table('forms')
      .insert({
        slug,
        title,
        description,
        success_message: successMessage || null,
        thank_you_post_id: thankYouPostId || null,
        fields_json: db.raw('?::jsonb', [JSON.stringify(fields)]) as any,
        subscriptions_json: db.raw('?::jsonb', [JSON.stringify(subscriptions)]) as any,
        created_at: now,
        updated_at: now,
      })
      .returning('*')

    return response.created({
      data: {
        id: String((row as any).id),
        slug,
        title,
        description,
        fields,
        subscriptions,
        successMessage,
        thankYouPostId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    })
  }

  /**
   * PUT /api/forms-definitions/:id
   * Update an existing form definition.
   */
  async updateDefinition({ params, request, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'forms.edit')) {
      return response.forbidden({ error: 'Not allowed to update forms' })
    }

    const { id } = params
    const existing = await db.from('forms').where('id', id).first()
    if (!existing) {
      return response.notFound({ error: 'Form not found' })
    }

    const slugRaw = request.input('slug')
    const titleRaw = request.input('title')
    const descriptionRaw = request.input('description')
    const fieldsRaw = request.input('fields')
    const subscriptionsRaw = request.input('subscriptions')
    const successMessageRaw = request.input('successMessage')
    const thankYouPostIdRaw = request.input('thankYouPostId')

    const update: Record<string, any> = {
      updated_at: new Date(),
    }

    if (slugRaw !== undefined) {
      const slug = String(slugRaw || '').trim()
      if (!slug) {
        return response.badRequest({ error: 'slug cannot be empty' })
      }
      update.slug = slug
    }

    if (titleRaw !== undefined) {
      const title = String(titleRaw || '').trim()
      if (!title) {
        return response.badRequest({ error: 'title cannot be empty' })
      }
      update.title = title
    }

    if (descriptionRaw !== undefined) {
      update.description = descriptionRaw === null ? null : String(descriptionRaw)
    }

    if (successMessageRaw !== undefined) {
      const msg =
        successMessageRaw === null || String(successMessageRaw).trim() === ''
          ? null
          : String(successMessageRaw)
      update.success_message = msg
    }

    if (fieldsRaw !== undefined) {
      const nextFields = Array.isArray(fieldsRaw) ? fieldsRaw : []
      update.fields_json = db.raw('?::jsonb', [JSON.stringify(nextFields)]) as any
    }

    if (subscriptionsRaw !== undefined) {
      const nextSubs = Array.isArray(subscriptionsRaw) ? subscriptionsRaw : []
      update.subscriptions_json = db.raw('?::jsonb', [JSON.stringify(nextSubs)]) as any
    }

    if (thankYouPostIdRaw !== undefined) {
      const idStr = String(thankYouPostIdRaw || '').trim()
      update.thank_you_post_id = idStr === '' ? null : idStr
    }

    const [row] = await db.from('forms').where('id', id).update(update).returning('*')

    return response.ok({
      data: {
        id: String((row as any).id),
        slug: String((row as any).slug),
        title: String((row as any).title),
        description: (row as any).description ? String((row as any).description) : '',
        fields: Array.isArray((row as any).fields_json) ? (row as any).fields_json : [],
        subscriptions: Array.isArray((row as any).subscriptions_json)
          ? (row as any).subscriptions_json
          : [],
        successMessage: (row as any).success_message ? String((row as any).success_message) : '',
        thankYouPostId: (row as any).thank_you_post_id
          ? String((row as any).thank_you_post_id)
          : '',
        createdAt: (row as any).created_at ? new Date((row as any).created_at).toISOString() : null,
        updatedAt: (row as any).updated_at ? new Date((row as any).updated_at).toISOString() : null,
      },
    })
  }

  /**
   * DELETE /api/forms-definitions/:id
   * Delete a form definition.
   */
  async deleteDefinition({ params, response, auth }: HttpContext) {
    const role = (auth.use('web').user as any)?.role as
      | 'admin'
      | 'editor'
      | 'translator'
      | undefined
    if (!roleRegistry.hasPermission(role, 'forms.delete')) {
      return response.forbidden({ error: 'Not allowed to delete forms' })
    }

    const { id } = params
    const existing = await db.from('forms').where('id', id).first()
    if (!existing) {
      return response.notFound({ error: 'Form not found' })
    }

    await db.from('forms').where('id', id).delete()
    return response.noContent()
  }
}
