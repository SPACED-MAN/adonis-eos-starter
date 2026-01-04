import webhookService, { WebhookEvent } from '#services/webhook_service'

export interface DispatchWebhookOptions {
  event: WebhookEvent
  data: Record<string, unknown>
}

export class DispatchWebhookAction {
  async handle(options: DispatchWebhookOptions) {
    try {
      await webhookService.dispatch(options.event, options.data)
    } catch (error) {
      // Fail silently for webhooks to not block main operation
      console.error('[DispatchWebhookAction] Failed to dispatch webhook:', error)
    }
  }
}

export default new DispatchWebhookAction()

