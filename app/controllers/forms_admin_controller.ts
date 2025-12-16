import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import roleRegistry from '#services/role_registry'
import { coerceJsonArray } from '#helpers/jsonb'

export default class FormsAdminController {
  private parseArrayInput(value: any): { ok: true; value: any[] } | { ok: false; error: string } {
    if (Array.isArray(value)) return { ok: true, value }
    // Treat null as invalid to prevent accidental wipes (explicit null should be rejected).
    if (value === undefined) return { ok: true, value: [] }
    if (value === null) return { ok: false, error: 'must be an array' }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) return { ok: true, value: parsed }
        return { ok: false, error: 'must be a JSON array' }
      } catch {
        return { ok: false, error: 'must be a JSON array' }
      }
    }
    return { ok: false, error: 'must be an array' }
  }

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

    const formRows = await db
      .from('forms')
      .orderBy('created_at', 'desc')
      .select(
        '*',
        db.raw('fields_json::text as fields_json_text'),
        db.raw('subscriptions_json::text as subscriptions_json_text')
      )

    const forms = (formRows as any[]).map((r) => ({
      id: String((r as any).id),
      slug: String((r as any).slug),
      title: String((r as any).title),
      description: (r as any).description ? String((r as any).description) : '',
      fields: coerceJsonArray((r as any).fields_json_text ?? (r as any).fields_json),
      successMessage: (r as any).success_message ? String((r as any).success_message) : '',
      thankYouPostId: (r as any).thank_you_post_id ? String((r as any).thank_you_post_id) : '',
      subscriptions: coerceJsonArray(
        (r as any).subscriptions_json_text ?? (r as any).subscriptions_json
      ),
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
    const rows = await db
      .from('forms')
      .orderBy('created_at', 'desc')
      .select(
        '*',
        db.raw('fields_json::text as fields_json_text'),
        db.raw('subscriptions_json::text as subscriptions_json_text')
      )
    const forms = (rows as any[]).map((r) => ({
      id: String((r as any).id),
      slug: String((r as any).slug),
      title: String((r as any).title),
      description: (r as any).description ? String((r as any).description) : '',
      fields: coerceJsonArray((r as any).fields_json_text ?? (r as any).fields_json),
      successMessage: (r as any).success_message ? String((r as any).success_message) : '',
      thankYouPostId: (r as any).thank_you_post_id ? String((r as any).thank_you_post_id) : '',
      subscriptions: coerceJsonArray(
        (r as any).subscriptions_json_text ?? (r as any).subscriptions_json
      ),
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

    const body = (request.body() || {}) as any
    const slugRaw = body.slug
    const titleRaw = body.title
    const descriptionRaw = body.description
    const fieldsRaw = body.fields
    const subscriptionsRaw = body.subscriptions
    const successMessageRaw = body.successMessage
    const thankYouPostIdRaw = body.thankYouPostId

    const slug = String(slugRaw || '').trim()
    const title = String(titleRaw || '').trim()
    const description =
      descriptionRaw !== undefined && descriptionRaw !== null ? String(descriptionRaw) : ''
    const fieldsParsed = this.parseArrayInput(fieldsRaw)
    if (!fieldsParsed.ok) {
      return response.badRequest({
        error: `fields ${fieldsParsed.error}`,
        meta: { receivedType: typeof fieldsRaw },
      })
    }
    const subsParsed = this.parseArrayInput(subscriptionsRaw)
    if (!subsParsed.ok) {
      return response.badRequest({
        error: `subscriptions ${subsParsed.error}`,
        meta: { receivedType: typeof subscriptionsRaw },
      })
    }
    const fields = fieldsParsed.value
    const subscriptions = subsParsed.value
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
        // Explicit JSONB cast keeps behavior consistent across pg driver configs.
        // IMPORTANT: Use rawQuery().knexQuery so this is treated as SQL, not serialized as JSON.
        fields_json: db.rawQuery('?::jsonb', [JSON.stringify(fields)]).knexQuery as any,
        subscriptions_json: db.rawQuery('?::jsonb', [JSON.stringify(subscriptions)]).knexQuery as any,
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

    const body = (request.body() || {}) as any
    const slugRaw = body.slug
    const titleRaw = body.title
    const descriptionRaw = body.description
    const fieldsRaw = body.fields
    const subscriptionsRaw = body.subscriptions
    const successMessageRaw = body.successMessage
    const thankYouPostIdRaw = body.thankYouPostId

    const update: Record<string, any> = {
      updated_at: new Date(),
    }

    if (Object.prototype.hasOwnProperty.call(body, 'slug')) {
      const slug = String(slugRaw || '').trim()
      if (!slug) {
        return response.badRequest({ error: 'slug cannot be empty' })
      }
      update.slug = slug
    }

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = String(titleRaw || '').trim()
      if (!title) {
        return response.badRequest({ error: 'title cannot be empty' })
      }
      update.title = title
    }

    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      update.description = descriptionRaw === null ? null : String(descriptionRaw)
    }

    if (Object.prototype.hasOwnProperty.call(body, 'successMessage')) {
      const msg =
        successMessageRaw === null || String(successMessageRaw).trim() === ''
          ? null
          : String(successMessageRaw)
      update.success_message = msg
    }

    if (Object.prototype.hasOwnProperty.call(body, 'fields')) {
      const parsed = this.parseArrayInput(fieldsRaw)
      if (!parsed.ok) {
        // Critical safety: never silently wipe fields on bad input.
        return response.badRequest({
          error: `fields ${parsed.error}`,
          meta: { receivedType: typeof fieldsRaw },
        })
      }
      const nextFields = parsed.value
      update.fields_json = db.rawQuery('?::jsonb', [JSON.stringify(nextFields)]).knexQuery as any
    }

    if (Object.prototype.hasOwnProperty.call(body, 'subscriptions')) {
      const parsed = this.parseArrayInput(subscriptionsRaw)
      if (!parsed.ok) {
        return response.badRequest({
          error: `subscriptions ${parsed.error}`,
          meta: { receivedType: typeof subscriptionsRaw },
        })
      }
      const nextSubs = parsed.value
      update.subscriptions_json = db.rawQuery('?::jsonb', [JSON.stringify(nextSubs)]).knexQuery as any
    }

    if (Object.prototype.hasOwnProperty.call(body, 'thankYouPostId')) {
      const idStr = String(thankYouPostIdRaw || '').trim()
      update.thank_you_post_id = idStr === '' ? null : idStr
    }

    // Perform update first, then re-fetch the row. In some environments/drivers, JSONB values
    // can come back from `returning('*')` in an inconsistent shape (string/object) vs selects.
    await db.from('forms').where('id', id).update(update)
    const row = await db
      .from('forms')
      .where('id', id)
      .select(
        '*',
        db.raw('fields_json::text as fields_json_text'),
        db.raw('subscriptions_json::text as subscriptions_json_text')
      )
      .first()
    if (!row) {
      return response.notFound({ error: 'Form not found' })
    }

    const storedFields = coerceJsonArray((row as any).fields_json_text ?? (row as any).fields_json)
    const storedSubs = coerceJsonArray(
      (row as any).subscriptions_json_text ?? (row as any).subscriptions_json
    )

    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[FormsAdmin] updateDefinition stored fields_json_text', {
        id: String((row as any).id),
        fields_json_text: typeof (row as any).fields_json_text === 'string' ? (row as any).fields_json_text : null,
        storedFieldsCount: storedFields.length,
      })
    }

    return response.ok({
      data: {
        id: String((row as any).id),
        slug: String((row as any).slug),
        title: String((row as any).title),
        description: (row as any).description ? String((row as any).description) : '',
        fields: storedFields,
        subscriptions: storedSubs,
        successMessage: (row as any).success_message ? String((row as any).success_message) : '',
        thankYouPostId: (row as any).thank_you_post_id
          ? String((row as any).thank_you_post_id)
          : '',
        createdAt: (row as any).created_at ? new Date((row as any).created_at).toISOString() : null,
        updatedAt: (row as any).updated_at ? new Date((row as any).updated_at).toISOString() : null,
      },
      ...(process.env.NODE_ENV === 'development'
        ? {
          meta: {
            receivedFieldsType: Object.prototype.hasOwnProperty.call(body, 'fields')
              ? typeof fieldsRaw
              : 'absent',
            receivedFieldsIsArray: Object.prototype.hasOwnProperty.call(body, 'fields')
              ? Array.isArray(fieldsRaw)
              : false,
            receivedFieldsCount:
              Object.prototype.hasOwnProperty.call(body, 'fields') && Array.isArray(fieldsRaw)
                ? (fieldsRaw as any[]).length
                : null,
            storedFieldsType: typeof (row as any).fields_json,
            storedFieldsCount: storedFields.length,
            storedFieldsTextPreview:
              typeof (row as any).fields_json_text === 'string'
                ? String((row as any).fields_json_text).slice(0, 200)
                : null,
          },
        }
        : {}),
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
