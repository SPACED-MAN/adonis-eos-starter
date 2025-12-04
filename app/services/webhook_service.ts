import db from '@adonisjs/lucid/services/db'
import { createHmac } from 'node:crypto'
import cmsConfig from '#config/cms'

/**
 * Webhook events
 */
export type WebhookEvent =
  | 'post.created'
  | 'post.updated'
  | 'post.published'
  | 'post.unpublished'
  | 'post.deleted'
  | 'post.restored'
  | 'media.uploaded'
  | 'media.deleted'
  | 'user.created'
  | 'user.updated'
  | 'settings.updated'
  | 'form.submitted'

/**
 * Webhook payload
 */
export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: Record<string, unknown>
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  id: string
  name: string
  url: string
  secret: string | null
  events: WebhookEvent[]
  active: boolean
  headers: Record<string, string> | null
  timeoutMs: number
  maxRetries: number
}

/**
 * Delivery result
 */
export interface DeliveryResult {
  webhookId: string
  success: boolean
  statusCode?: number
  error?: string
  durationMs?: number
}

/**
 * Webhook Service
 *
 * Manages webhook registration and delivery for external integrations.
 */
class WebhookService {
  /**
   * Check if webhooks are enabled
   */
  isEnabled(): boolean {
    return cmsConfig.webhooks.enabled
  }

  /**
   * Generate signature for webhook payload
   */
  private generateSignature(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex')
  }

  /**
   * Get all webhooks subscribed to an event
   */
  async getWebhooksForEvent(event: WebhookEvent): Promise<WebhookConfig[]> {
    if (!this.isEnabled()) return []

    const rows = await db
      .from('webhooks')
      .where('active', true)
      .whereRaw('? = ANY(events)', [event])

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      secret: r.secret,
      events: r.events,
      active: r.active,
      headers: r.headers,
      timeoutMs: r.timeout_ms,
      maxRetries: r.max_retries,
    }))
  }

  /**
   * Dispatch webhook to a single endpoint
   */
  private async deliverWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload,
    attempt: number = 1
  ): Promise<DeliveryResult> {
    const startTime = Date.now()
    const payloadString = JSON.stringify(payload)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      'X-Webhook-Delivery-Attempt': String(attempt),
      ...(webhook.headers || {}),
    }

    // Add signature if secret is configured
    if (webhook.secret) {
      headers['X-Webhook-Signature'] =
        `sha256=${this.generateSignature(payloadString, webhook.secret)}`
    }

    // Use global secret as fallback
    if (!webhook.secret && cmsConfig.webhooks.secret) {
      headers['X-Webhook-Signature'] =
        `sha256=${this.generateSignature(payloadString, cmsConfig.webhooks.secret)}`
    }

    let deliveryId: string | undefined

    try {
      // Log the delivery attempt
      const [insertResult] = await db
        .table('webhook_deliveries')
        .insert({
          webhook_id: webhook.id,
          event: payload.event,
          payload: payload,
          attempt,
          status: 'pending',
        })
        .returning('id')

      deliveryId = insertResult?.id

      // Make the HTTP request
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), webhook.timeoutMs)

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const durationMs = Date.now() - startTime
      const responseBody = await response.text().catch(() => '')

      // Update delivery record
      if (deliveryId) {
        await db
          .from('webhook_deliveries')
          .where('id', deliveryId)
          .update({
            response_status: response.status,
            response_body: responseBody.substring(0, 10000), // Truncate long responses
            duration_ms: durationMs,
            status: response.ok ? 'success' : 'failed',
          })
      }

      // Update webhook last triggered
      await db
        .from('webhooks')
        .where('id', webhook.id)
        .update({
          last_triggered_at: new Date(),
          last_status: response.ok ? 'success' : `failed:${response.status}`,
          updated_at: new Date(),
        })

      return {
        webhookId: webhook.id,
        success: response.ok,
        statusCode: response.status,
        durationMs,
      }
    } catch (error) {
      const durationMs = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Update delivery record
      if (deliveryId) {
        await db
          .from('webhook_deliveries')
          .where('id', deliveryId)
          .update({
            duration_ms: durationMs,
            status: attempt < webhook.maxRetries ? 'retrying' : 'failed',
            error: errorMessage,
          })
      }

      // Update webhook last status
      await db
        .from('webhooks')
        .where('id', webhook.id)
        .update({
          last_triggered_at: new Date(),
          last_status: `error:${errorMessage.substring(0, 50)}`,
          updated_at: new Date(),
        })

      // Retry if not exhausted
      if (attempt < webhook.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, ...
        const delay = Math.pow(2, attempt - 1) * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.deliverWebhook(webhook, payload, attempt + 1)
      }

      return {
        webhookId: webhook.id,
        success: false,
        error: errorMessage,
        durationMs,
      }
    }
  }

  /**
   * Dispatch event to all subscribed webhooks
   */
  async dispatch(event: WebhookEvent, data: Record<string, unknown>): Promise<DeliveryResult[]> {
    if (!this.isEnabled()) return []

    const webhooks = await this.getWebhooksForEvent(event)
    if (webhooks.length === 0) return []

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    }
    // Deliver to all webhooks in parallel
    const results = await Promise.all(
      webhooks.map((webhook) => this.deliverWebhook(webhook, payload))
    )

    return results
  }

  /**
   * Dispatch event to a specific set of webhook IDs (bypassing event filters).
   */
  async dispatchToWebhooks(
    webhookIds: string[],
    event: WebhookEvent,
    data: Record<string, unknown>
  ): Promise<DeliveryResult[]> {
    if (!this.isEnabled() || webhookIds.length === 0) return []

    const rows = await db.from('webhooks').whereIn('id', webhookIds).andWhere('active', true)

    if (rows.length === 0) return []

    const webhooks: WebhookConfig[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      secret: r.secret,
      events: r.events,
      active: r.active,
      headers: r.headers,
      timeoutMs: r.timeout_ms,
      maxRetries: r.max_retries,
    }))

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    }

    const results = await Promise.all(
      webhooks.map((webhook) => this.deliverWebhook(webhook, payload))
    )

    return results
  }

  /**
   * Create a new webhook
   */
  async create(config: Omit<WebhookConfig, 'id'>): Promise<WebhookConfig> {
    const [row] = await db
      .table('webhooks')
      .insert({
        name: config.name,
        url: config.url,
        secret: config.secret,
        events: config.events,
        active: config.active,
        headers: config.headers,
        timeout_ms: config.timeoutMs || cmsConfig.webhooks.timeout,
        max_retries: config.maxRetries || cmsConfig.webhooks.maxRetries,
      })
      .returning('*')

    return {
      id: row.id,
      name: row.name,
      url: row.url,
      secret: row.secret,
      events: row.events,
      active: row.active,
      headers: row.headers,
      timeoutMs: row.timeout_ms,
      maxRetries: row.max_retries,
    }
  }

  /**
   * Update a webhook
   */
  async update(
    id: string,
    updates: Partial<Omit<WebhookConfig, 'id'>>
  ): Promise<WebhookConfig | null> {
    const updateData: Record<string, unknown> = { updated_at: new Date() }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.url !== undefined) updateData.url = updates.url
    if (updates.secret !== undefined) updateData.secret = updates.secret
    if (updates.events !== undefined) updateData.events = updates.events
    if (updates.active !== undefined) updateData.active = updates.active
    if (updates.headers !== undefined) updateData.headers = updates.headers
    if (updates.timeoutMs !== undefined) updateData.timeout_ms = updates.timeoutMs
    if (updates.maxRetries !== undefined) updateData.max_retries = updates.maxRetries

    const [row] = await db.from('webhooks').where('id', id).update(updateData).returning('*')

    if (!row) return null

    return {
      id: row.id,
      name: row.name,
      url: row.url,
      secret: row.secret,
      events: row.events,
      active: row.active,
      headers: row.headers,
      timeoutMs: row.timeout_ms,
      maxRetries: row.max_retries,
    }
  }

  /**
   * Delete a webhook
   */
  async delete(id: string): Promise<boolean> {
    const deleted = await db.from('webhooks').where('id', id).delete()
    return deleted > 0
  }

  /**
   * List all webhooks
   */
  async list(): Promise<WebhookConfig[]> {
    const rows = await db.from('webhooks').orderBy('created_at', 'desc')

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      secret: r.secret,
      events: r.events,
      active: r.active,
      headers: r.headers,
      timeoutMs: r.timeout_ms,
      maxRetries: r.max_retries,
    }))
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(
    webhookId: string,
    limit: number = 50
  ): Promise<
    Array<{
      id: string
      event: string
      status: string
      responseStatus: number | null
      durationMs: number | null
      attempt: number
      error: string | null
      createdAt: Date
    }>
  > {
    const rows = await db
      .from('webhook_deliveries')
      .where('webhook_id', webhookId)
      .orderBy('created_at', 'desc')
      .limit(limit)

    return rows.map((r) => ({
      id: r.id,
      event: r.event,
      status: r.status,
      responseStatus: r.response_status,
      durationMs: r.duration_ms,
      attempt: r.attempt,
      error: r.error,
      createdAt: new Date(r.created_at),
    }))
  }
}

const webhookService = new WebhookService()
export default webhookService
