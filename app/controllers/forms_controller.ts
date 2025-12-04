import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import crypto from 'node:crypto'
import webhookService from '#services/webhook_service'
import type { FormConfig } from '#types/form_types'

export default class FormsController {
  private mapRowToFormConfig(row: any): FormConfig {
    const fieldsRaw = Array.isArray(row.fields_json) ? row.fields_json : []
    const fields = fieldsRaw.map((f: any) => ({
      slug: String(f.slug || ''),
      label: String(f.label || f.slug || ''),
      type: (f.type as any) || 'text',
      required: Boolean(f.required),
    }))

    return {
      slug: String(row.slug),
      title: String(row.title),
      description: row.description ? String(row.description) : undefined,
      fields,
      successMessage: (row as any).success_message
        ? String((row as any).success_message)
        : undefined,
    }
  }

  /**
   * GET /api/forms/:slug
   * Returns the public form definition (fields, labels, etc.).
   */
  async show({ params, response }: HttpContext) {
    const slug = String(params.slug || '').trim()
    const row = await db.from('forms').where('slug', slug).first()
    if (!row) {
      return response.notFound({ error: 'Form not found' })
    }

    const form = this.mapRowToFormConfig(row)
    return response.ok({ data: form })
  }

  /**
   * POST /api/forms/:slug
   * Accepts a JSON body with field values keyed by field slug.
   * Example: { name: 'John', email: 'john@example.com', message: 'Hi' }
   */
  async submit({ params, request, response }: HttpContext) {
    const slug = String(params.slug || '').trim()
    const row = await db.from('forms').where('slug', slug).first()
    if (!row) {
      return response.notFound({ error: 'Form not found' })
    }

    const form = this.mapRowToFormConfig(row)

    const body = request.body() as Record<string, unknown>
    const errors: Record<string, string> = {}
    const payload: Record<string, unknown> = {}

    for (const field of form.fields) {
      const raw = body[field.slug]
      const val = typeof raw === 'string' ? raw.trim() : raw === undefined ? undefined : raw

      if (field.required && (val === undefined || val === null || val === '')) {
        errors[field.slug] = 'This field is required.'
        continue
      }

      if (field.type === 'email' && typeof val === 'string' && val) {
        const simpleEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!simpleEmail.test(val)) {
          errors[field.slug] = 'Please enter a valid email address.'
          continue
        }
      }

      if (field.type === 'checkbox') {
        payload[field.slug] = Boolean(val)
      } else if (val !== undefined) {
        payload[field.slug] = val
      } else {
        payload[field.slug] = null
      }
    }

    if (Object.keys(errors).length > 0) {
      return response.badRequest({ errors })
    }

    const now = new Date()
    const ip = request.ip()
    const userAgent = request.header('user-agent') || null

    const [inserted] = await db
      .table('form_submissions')
      .insert({
        id: crypto.randomUUID(),
        form_slug: slug,
        payload,
        ip_address: ip,
        user_agent: userAgent,
        created_at: now,
        updated_at: now,
      })
      .returning('*')

    const submissionId = (inserted as any)?.id

    // Fire global webhooks for form submission; integrators can subscribe to 'form.submitted'
    try {
      await webhookService.dispatch('form.submitted', {
        formSlug: slug,
        submissionId,
        payload,
      })
    } catch {
      // Webhook failures should not block the user-facing success response.
    }

    // Fire any per-form subscriptions (webhook IDs stored on the form)
    try {
      const subsRaw = Array.isArray((row as any).subscriptions_json)
        ? (row as any).subscriptions_json
        : []
      const webhookIds: string[] = subsRaw
        .map((s: any) => {
          if (typeof s === 'string') return s
          if (s && typeof s.webhookId === 'string') return s.webhookId
          return null
        })
        .filter((id: string | null): id is string => !!id)

      if (webhookIds.length > 0) {
        await webhookService.dispatchToWebhooks(webhookIds, 'form.submitted', {
          formSlug: slug,
          submissionId,
          payload,
        })
      }
    } catch {
      // Ignore subscription-specific errors
    }

    // Optional thank-you redirect
    let redirectTo: string | null = null
    const thankYouPostId = (row as any).thank_you_post_id
      ? String((row as any).thank_you_post_id)
      : ''
    if (thankYouPostId) {
      const post = await db.from('posts').where('id', thankYouPostId).first()
      if (post && (post as any).slug) {
        redirectTo = `/posts/${encodeURIComponent(String((post as any).slug))}`
      }
    }

    return response.ok({
      data: {
        id: submissionId,
        redirectTo,
        successMessage: form.successMessage,
      },
    })
  }
}
