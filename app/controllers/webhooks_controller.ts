import type { HttpContext } from '@adonisjs/core/http'
import webhookService, { type WebhookEvent } from '#services/webhook_service'
import responseService from '#services/response_service'
import vine from '@vinejs/vine'

/**
 * Webhook validator
 */
const webhookValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100),
    url: vine.string().trim().url(),
    secret: vine.string().trim().maxLength(255).nullable().optional(),
    events: vine.array(vine.string()).minLength(1),
    active: vine.boolean().optional(),
    headers: vine.any().optional(),
    timeoutMs: vine.number().min(1000).max(30000).optional(),
    maxRetries: vine.number().min(0).max(10).optional(),
  })
)

/**
 * Webhooks Controller
 *
 * Manages webhook configuration and delivery history.
 */
export default class WebhooksController {
  /**
   * GET /api/webhooks
   * List all webhooks
   */
  async index({ response }: HttpContext) {
    if (!webhookService.isEnabled()) {
      return responseService.badRequest(response, 'Webhooks are not enabled')
    }

    const webhooks = await webhookService.list()

    return response.ok({
      data: webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        events: w.events,
        active: w.active,
        timeoutMs: w.timeoutMs,
        maxRetries: w.maxRetries,
      })),
    })
  }

  /**
   * POST /api/webhooks
   * Create a new webhook
   */
  async store({ request, response }: HttpContext) {
    if (!webhookService.isEnabled()) {
      return responseService.badRequest(response, 'Webhooks are not enabled')
    }

    const payload = await request.validateUsing(webhookValidator)

    const webhook = await webhookService.create({
      name: payload.name,
      url: payload.url,
      secret: payload.secret ?? null,
      events: payload.events as WebhookEvent[],
      active: payload.active ?? true,
      headers: payload.headers ?? null,
      timeoutMs: payload.timeoutMs || 5000,
      maxRetries: payload.maxRetries || 3,
    })

    return responseService.created(
      response,
      {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
      },
      'Webhook created successfully'
    )
  }

  /**
   * PUT /api/webhooks/:id
   * Update a webhook
   */
  async update({ params, request, response }: HttpContext) {
    if (!webhookService.isEnabled()) {
      return responseService.badRequest(response, 'Webhooks are not enabled')
    }

    const { id } = params
    const payload = await request.validateUsing(webhookValidator)

    const webhook = await webhookService.update(id, {
      name: payload.name,
      url: payload.url,
      secret: payload.secret ?? null,
      events: payload.events as WebhookEvent[],
      active: payload.active ?? true,
      headers: payload.headers ?? null,
      timeoutMs: payload.timeoutMs,
      maxRetries: payload.maxRetries,
    })

    if (!webhook) {
      return responseService.notFound(response, 'Webhook not found')
    }

    return response.ok({
      data: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        active: webhook.active,
      },
      message: 'Webhook updated successfully',
    })
  }

  /**
   * DELETE /api/webhooks/:id
   * Delete a webhook
   */
  async destroy({ params, response }: HttpContext) {
    if (!webhookService.isEnabled()) {
      return responseService.badRequest(response, 'Webhooks are not enabled')
    }

    const { id } = params
    const deleted = await webhookService.delete(id)

    if (!deleted) {
      return responseService.notFound(response, 'Webhook not found')
    }

    return responseService.noContent(response)
  }

  /**
   * GET /api/webhooks/:id/deliveries
   * Get delivery history for a webhook
   */
  async deliveries({ params, request, response }: HttpContext) {
    if (!webhookService.isEnabled()) {
      return responseService.badRequest(response, 'Webhooks are not enabled')
    }

    const { id } = params
    const limit = Math.min(100, Math.max(1, Number(request.input('limit', 50)) || 50))

    const history = await webhookService.getDeliveryHistory(id, limit)

    return response.ok({
      data: history.map((d) => ({
        id: d.id,
        event: d.event,
        status: d.status,
        responseStatus: d.responseStatus,
        durationMs: d.durationMs,
        attempt: d.attempt,
        error: d.error,
        createdAt: d.createdAt.toISOString(),
      })),
    })
  }

  /**
   * POST /api/webhooks/:id/test
   * Send a test webhook
   */
  async test({ params, response }: HttpContext) {
    if (!webhookService.isEnabled()) {
      return responseService.badRequest(response, 'Webhooks are not enabled')
    }

    const { id } = params

    // Get webhook config
    const webhooks = await webhookService.list()
    const webhook = webhooks.find((w) => w.id === id)

    if (!webhook) {
      return responseService.notFound(response, 'Webhook not found')
    }

    // Send test payload
    const testEvent = webhook.events[0] || 'post.updated'
    const results = await webhookService.dispatch(testEvent as WebhookEvent, {
      test: true,
      message: 'This is a test webhook delivery',
      timestamp: new Date().toISOString(),
    })

    const result = results.find((r) => r.webhookId === id)

    return response.ok({
      success: result?.success ?? false,
      statusCode: result?.statusCode,
      error: result?.error,
      durationMs: result?.durationMs,
    })
  }
}
