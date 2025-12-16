import type { WorkflowDefinition } from '#types/workflow_types'

/**
 * n8n Webhook Workflow
 *
 * Example workflow that triggers an n8n webhook on various post events.
 * This can be used to integrate with n8n workflows for complex automation.
 *
 * To enable:
 * 1. Set enabled: true
 * 2. Configure webhook.url with your n8n webhook URL
 * 3. Optionally configure webhook.secret for authentication
 */
const N8nWebhookWorkflow: WorkflowDefinition = {
  id: 'n8n-webhook',
  name: 'n8n Webhook',
  description: 'Triggers an n8n webhook on post events',
  type: 'webhook',
  enabled: false, // Set to true to enable

  webhook: {
    url: process.env.N8N_WEBHOOK_URL || '', // Your n8n webhook URL
    method: 'POST',
    timeout: 30000, // 30 seconds
    retryOnFailure: true,
    retryAttempts: 3,
    retryDelay: 2000,
  },

  triggers: [
    {
      trigger: 'post.created',
      order: 10,
      enabled: true,
    },
    {
      trigger: 'post.updated',
      order: 10,
      enabled: true,
    },
    {
      trigger: 'post.published',
      order: 10,
      enabled: true,
    },
  ],

  userAccount: {
    enabled: true,
  },
}

export default N8nWebhookWorkflow

