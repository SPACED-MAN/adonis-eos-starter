import type { WorkflowDefinition } from '#types/workflow_types'

/**
 * Slack Notifier Workflow
 *
 * Sends a Slack notification when a post is published.
 * Configure your Slack webhook URL in the webhook.url field.
 *
 * To enable:
 * 1. Set enabled: true
 * 2. Configure webhook.url with your Slack webhook URL
 * 3. Optionally configure webhook.secret for authentication
 */
const SlackNotifierWorkflow: WorkflowDefinition = {
  id: 'slack-notifier',
  name: 'Slack Notifier',
  description: 'Sends a Slack notification when a post is published',
  type: 'webhook',
  enabled: false, // Set to true to enable

  webhook: {
    url: process.env.SLACK_WEBHOOK_URL || '', // Your Slack webhook URL
    method: 'POST',
    timeout: 10000, // 10 seconds
    retryOnFailure: true,
    retryAttempts: 3,
    retryDelay: 1000,
  },

  triggers: [
    {
      trigger: 'post.published',
      order: 10,
      enabled: true,
      // Optionally restrict to specific post types
      // postTypes: ['blog', 'page'],
    },
  ],

  // Transform payload to Slack message format
  transformPayload: (payload: any) => {
    const post = payload.post || {}
    return {
      text: `New post published: ${post.title || 'Untitled'}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*New Post Published*\n\n*Title:* ${post.title || 'Untitled'}\n*Slug:* ${post.slug || 'N/A'}\n*Type:* ${post.type || 'N/A'}`,
          },
        },
      ],
    }
  },

  userAccount: {
    enabled: true,
  },
}

export default SlackNotifierWorkflow

