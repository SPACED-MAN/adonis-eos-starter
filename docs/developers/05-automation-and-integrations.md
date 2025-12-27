# Automation & Integrations

Adonis EOS provides two complementary systems for event-driven automation: **Workflows** (code-first) and **Webhooks** (database-first).

## Workflows vs Webhooks

| Feature        | Workflows                                    | Webhooks                           |
| :------------- | :------------------------------------------- | :--------------------------------- |
| **Definition** | TypeScript files in `app/workflows/*`        | Database records (Admin UI)        |
| **Logic**      | Full power of TypeScript (transforms, logic) | Direct JSON relay of event data    |
| **Audience**   | Developers                                   | Site Administrators                |
| **Use Cases**  | Slack bots, n8n, complex automation          | Simple Zapier/webhook integrations |

---

## 1. Workflows (Code-First)

Workflows are file-based definitions used for robust, logic-heavy automation.

### Creating a Workflow

Create a new file in `app/workflows/` (e.g., `app/workflows/slack_notifier.ts`):

```typescript
import type { WorkflowDefinition } from '#types/workflow_types'

const SlackNotifierWorkflow: WorkflowDefinition = {
  id: 'slack-notifier',
  name: 'Slack Notifier',
  description: 'Sends a Slack notification when a post is published',
  type: 'webhook',
  enabled: true,

  webhook: {
    url: process.env.SLACK_WEBHOOK_URL || '',
    method: 'POST',
    timeout: 10000,
    retryOnFailure: true,
    retryAttempts: 3,
  },

  triggers: [{ trigger: 'post.published', enabled: true }],

  transformPayload: (payload: any) => ({
    text: `New post published: ${payload.post?.title || 'Untitled'}`,
  }),
}

export default SlackNotifierWorkflow
```

### Supported Triggers

- **Post Events**: `post.created`, `post.updated`, `post.published`, `post.approved`, `post.review.save`, `post.ai-review.save`, etc.
- **Form Events**: `form.submit`
- **System Events**: `agent.completed`, `workflow.completed`, `manual`

---

## 2. Webhooks (Database-First)

Webhooks are configured via the Admin UI (**Settings > Webhooks**) and are ideal for simple relaying of CMS events to external services.

### Configuration

Each webhook supports:

- **Events**: Subscribed events (e.g., `post.published`, `media.uploaded`)
- **Secret**: Per-webhook signing secret for signature verification.
- **Headers**: Custom HTTP headers.
- **Retries**: Configurable retry count with exponential backoff.

### Payload & Verification

Webhooks are sent as `POST` requests with a JSON body and an `X-Webhook-Signature` header.

```js
// Verification Example (Node.js)
import crypto from 'node:crypto'

export function verify(reqBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(reqBody).digest('hex')
  return signature === `sha256=${expected}`
}
```

---

## 3. Security (SOC2 Compliance)

Outbound integrations are high-risk. Follow these best practices:

- **Use HTTPS** for all destination URLs.
- **Set Signing Secrets**: Always verify signatures on the receiving end.
- **Avoid Private Networks**: Do not point webhooks to localhost or internal IP ranges (SSRF protection).
- **Log Deliveries**: Review `webhook_deliveries` in the database for auditing and debugging.
