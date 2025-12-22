import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import crypto from 'node:crypto'
import webhookService from '#services/webhook_service'
import formRegistry from '#services/form_registry'

export default class FormsController {
  /**
   * GET /api/forms/:slug
   * Returns the public form definition (fields, labels, etc.).
   */
  async show({ params, response }: HttpContext) {
    const slug = String(params.slug || '').trim()
    const form = formRegistry.get(slug)

    if (!form) {
      return response.notFound({ error: 'Form not found' })
    }

    return response.ok({ data: form })
  }

  /**
   * POST /api/forms/:slug
   * Accepts a JSON body with field values keyed by field slug.
   * Example: { name: 'John', email: 'john@example.com', message: 'Hi' }
   */
  async submit({ params, request, response }: HttpContext) {
    const slug = String(params.slug || '').trim()
    const form = formRegistry.get(slug)

    if (!form) {
      return response.notFound({ error: 'Form not found' })
    }

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

      // Basic email validation for text fields with slug 'email' or if we want to be more explicit
      if (
        (field.slug === 'email' || field.type === ( 'email' as any)) &&
        typeof val === 'string' &&
        val
      ) {
        const simpleEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!simpleEmail.test(val)) {
          errors[field.slug] = 'Please enter a valid email address.'
          continue
        }
      }

      if (field.type === 'boolean') {
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

    // Fire global webhooks for form submission
    try {
      await webhookService.dispatch('form.submitted', {
        formSlug: slug,
        submissionId,
        payload,
      })
    } catch {
      // Webhook failures should not block the user-facing success response.
    }

    // Fire any per-form subscriptions
    if (Array.isArray(form.subscriptions) && form.subscriptions.length > 0) {
      try {
        await webhookService.dispatchToWebhooks(form.subscriptions, 'form.submitted', {
          formSlug: slug,
          submissionId,
          payload,
        })
      } catch {
        // Ignore subscription-specific errors
      }
    }

    // Optional thank-you redirect
    let redirectTo: string | null = null
    if (form.thankYouPostId) {
      const post = await db.from('posts').where('id', form.thankYouPostId).first()
      if (post && (post as any).slug) {
        redirectTo = `/posts/${encodeURIComponent(String((post as any).slug))}`
      }
    }

    return response.ok({
      data: {
        id: submissionId,
        redirectTo,
        successMessage: form.successMessage || 'Thank you! Your submission has been received.',
      },
    })
  }
}
