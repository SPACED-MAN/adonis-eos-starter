# Workflows

Event-driven automation system for webhook-based integrations, notifications, and external service triggers.

## Overview

Workflows are file-based definitions that can:

- Trigger automatically on specific events (post created, published, etc.)
- Call external webhooks (n8n, Zapier, Slack, custom services)
- Execute complex automation chains
- Send notifications and alerts

**Note**: Workflows are separate from [AI Agents](09-ai-agents.md). Use workflows for webhook-based automation, and agents for AI-powered content enhancement.

## When to Use Workflows vs Agents

| Feature           | Workflows                                        | AI Agents                                           |
| ----------------- | ------------------------------------------------ | --------------------------------------------------- |
| **Purpose**       | Automation & integrations                        | Content enhancement                                 |
| **Trigger**       | Event-driven (post.published, form.submit, etc.) | Manual or event-driven                              |
| **Execution**     | Webhook calls to external services               | In-process AI processing                            |
| **Use Cases**     | n8n workflows, Slack notifications, data sync    | SEO optimization, content improvement, translations |
| **Configuration** | Webhook URLs, secrets, retry logic               | AI providers, models, prompts                       |

## Workflow Types

Currently, only **webhook** workflows are supported:

### Webhook Workflows

Webhook workflows call external HTTP endpoints when triggered:

- n8n workflows
- Zapier integrations
- Slack notifications
- Custom microservices
- Third-party APIs

## Creating a Workflow

### 1. Create Workflow File

Create a new file in `app/workflows/`:

```bash
# Example: app/workflows/slack_notifier.ts
```

### 2. Define Workflow Configuration

```typescript
import type { WorkflowDefinition } from '#types/workflow_types'

const SlackNotifierWorkflow: WorkflowDefinition = {
  id: 'slack-notifier',
  name: 'Slack Notifier',
  description: 'Sends a Slack notification when a post is published',
  type: 'webhook',
  enabled: true, // Set to true to enable

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

  // Optional: Transform payload before sending
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
```

### 3. Configure Environment

Set your webhook URL in `.env`:

```env
# Slack webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# n8n webhook
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/your-workflow
```

## Workflow Triggers

Workflows can be triggered by various events:

### Post Events

- **`post.created`** - Post is created
- **`post.updated`** - Post is updated
- **`post.published`** - Post is published
- **`post.approved`** - Post changes are approved (Source mode)
- **`post.review.save`** - Post is saved for review
- **`post.review.approve`** - Review draft is approved
- **`post.ai-review.save`** - AI review draft is saved
- **`post.ai-review.approve`** - AI review is approved

### Form Events

- **`form.submit`** - Form is submitted

### Agent/Workflow Events

- **`agent.completed`** - AI agent execution completes
- **`workflow.completed`** - Another workflow completes

### Manual Trigger

- **`manual`** - Manual trigger only (via UI or API)

## Trigger Configuration

### Basic Trigger

```typescript
triggers: [
  {
    trigger: 'post.published',
    order: 10,
    enabled: true,
  },
]
```

### Post Type Filtering

Only trigger for specific post types:

```typescript
triggers: [
  {
    trigger: 'post.published',
    order: 10,
    enabled: true,
    postTypes: ['blog', 'page'], // Only for blog and page posts
  },
]
```

### Form Slug Filtering

Only trigger for specific forms:

```typescript
triggers: [
  {
    trigger: 'form.submit',
    order: 10,
    enabled: true,
    formSlugs: ['contact-form', 'inquiry-form'], // Only these forms
  },
]
```

### Conditional Triggers

Execute only if a condition is met:

```typescript
triggers: [
  {
    trigger: 'post.published',
    order: 10,
    enabled: true,
    condition: async (payload) => {
      // Only trigger if post has a featured image
      return !!payload.post?.featuredImageId
    },
  },
]
```

### Agent/Workflow Filtering

Trigger only for specific agents or workflows:

```typescript
triggers: [
  {
    trigger: 'agent.completed',
    order: 10,
    enabled: true,
    agentIds: ['seo-optimizer', 'translator'], // Only for these agents
  },
  {
    trigger: 'workflow.completed',
    order: 10,
    enabled: true,
    workflowIds: ['slack-notifier'], // Only after this workflow
  },
]
```

## Webhook Configuration

### Basic Configuration

```typescript
webhook: {
  url: 'https://example.com/webhook',
  method: 'POST', // GET, POST, PUT, PATCH, DELETE
  timeout: 30000, // milliseconds
}
```

### Authentication

```typescript
webhook: {
  url: 'https://example.com/webhook',
  secret: process.env.WEBHOOK_SECRET,
  // Optional: custom header name (default: Authorization: Bearer)
  secretHeader: 'X-API-Key',
}
```

### Custom Headers

```typescript
webhook: {
  url: 'https://example.com/webhook',
  headers: {
    'X-Custom-Header': 'value',
    'Content-Type': 'application/json',
  },
}
```

### Retry Logic

```typescript
webhook: {
  url: 'https://example.com/webhook',
  retryOnFailure: true,
  retryAttempts: 3, // Number of retry attempts
  retryDelay: 1000, // Delay between retries (ms)
}
```

## Payload Transformation

Transform the payload before sending to the webhook:

```typescript
transformPayload: (payload: any) => {
  // Customize the payload structure
  return {
    event: 'post.published',
    post: {
      id: payload.post.id,
      title: payload.post.title,
      slug: payload.post.slug,
    },
    timestamp: new Date().toISOString(),
  }
}
```

## Execution Order

Multiple workflows on the same trigger execute in order:

```typescript
// Workflow 1: order 10 (runs first)
// Workflow 2: order 20 (runs second)
// Workflow 3: order 30 (runs third)
```

Lower numbers run first.

## Example Workflows

### Slack Notification

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
    retryDelay: 1000,
  },

  triggers: [
    {
      trigger: 'post.published',
      order: 10,
      enabled: true,
    },
  ],

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
```

### n8n Integration

```typescript
import type { WorkflowDefinition } from '#types/workflow_types'

const N8nWebhookWorkflow: WorkflowDefinition = {
  id: 'n8n-webhook',
  name: 'n8n Webhook',
  description: 'Triggers an n8n workflow on post events',
  type: 'webhook',
  enabled: true,

  webhook: {
    url: process.env.N8N_WEBHOOK_URL || '',
    method: 'POST',
    timeout: 30000,
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
```

## Per-Workflow User Accounts

Workflows can have dedicated user accounts for attribution:

```typescript
userAccount: {
  enabled: true,
  // email?: optional (generated if omitted: workflow+id@workflows.local)
  // username?: optional (defaults to workflow:id)
  // createAtBoot?: default true
}
```

Boot-time creation happens automatically during app start (via `start/workflows.ts`).

## API Endpoints

### List Workflows

```http
GET /api/workflows
Authorization: Bearer <token>
```

Returns all registered workflows.

### Get Workflow

```http
GET /api/workflows/:id
Authorization: Bearer <token>
```

Returns a specific workflow by ID.

### Manually Trigger Workflow

```http
POST /api/workflows/:id/trigger
Authorization: Bearer <token>
Content-Type: application/json

{
  "trigger": "manual",
  "payload": {
    "post": {
      "id": "uuid",
      "title": "Test Post"
    }
  },
  "context": {
    "userId": 123
  }
}
```

Manually trigger a workflow (useful for testing). Requires `workflows.trigger` permission.

## Payload Structure

Workflows receive event-specific payloads:

### Post Event Payload

```json
{
  "post": {
    "id": "uuid",
    "type": "blog",
    "locale": "en",
    "slug": "my-post",
    "title": "My Post",
    "status": "published",
    "excerpt": "Post summary",
    "metaTitle": null,
    "metaDescription": null,
    "canonicalUrl": null,
    "robotsJson": null,
    "jsonldOverrides": null,
    "featuredImageId": null
  },
  "modules": [
    {
      "type": "prose",
      "scope": "local",
      "orderIndex": 0,
      "props": {
        "content": {
          /* Lexical JSON */
        }
      }
    }
  ],
  "trigger": "post.published",
  "userId": 123,
  "timestamp": "2025-01-01T00:00:00Z"
}
```

### Form Submit Payload

```json
{
  "form": {
    "id": "uuid",
    "slug": "contact-form",
    "name": "Contact Form"
  },
  "submission": {
    "id": "uuid",
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "message": "Hello!"
    },
    "createdAt": "2025-01-01T00:00:00Z"
  },
  "trigger": "form.submit",
  "userId": 123
}
```

### Agent Completed Payload

```json
{
  "agent": {
    "id": "seo-optimizer",
    "name": "SEO Optimizer"
  },
  "post": {
    "id": "uuid",
    "title": "My Post"
  },
  "result": {
    "success": true,
    "applied": ["post.metaTitle", "post.metaDescription"]
  },
  "trigger": "agent.completed",
  "userId": 123
}
```

## Security

### RBAC Permissions

Workflows require specific permissions:

- **`workflows.view`** - View workflow definitions (admin, editor_admin)
- **`workflows.trigger`** - Manually trigger workflows (admin only)

### Webhook Authentication

Always use secrets for webhook authentication:

```typescript
webhook: {
  url: 'https://example.com/webhook',
  secret: process.env.WEBHOOK_SECRET,
  // Optional: custom header
  secretHeader: 'X-API-Key',
}
```

The secret is sent as:

- `Authorization: Bearer <secret>` (default)
- Or custom header if `secretHeader` is specified

## Best Practices

1. **Use retry logic**: Enable `retryOnFailure` for critical workflows
2. **Set appropriate timeouts**: Prevent hanging on slow webhooks
3. **Filter triggers**: Use `postTypes`, `formSlugs`, etc. to avoid unnecessary executions
4. **Transform payloads**: Use `transformPayload` to match your webhook's expected format
5. **Handle errors gracefully**: Your webhook should return appropriate HTTP status codes
6. **Log executions**: Check `workflow_executions` table for execution history
7. **Test manually**: Use the `/api/workflows/:id/trigger` endpoint to test workflows

## Troubleshooting

**Workflow not executing?**

- Check `enabled: true` in workflow definition
- Verify trigger is enabled: `triggers[].enabled: true`
- Check trigger filters (postTypes, formSlugs, etc.)
- Verify webhook URL is accessible
- Check execution logs in `workflow_executions` table

**Webhook timing out?**

- Increase `timeout` value
- Check webhook URL is accessible
- Test with curl/Postman first

**Retries not working?**

- Ensure `retryOnFailure: true`
- Check `retryAttempts` is set appropriately
- Verify webhook returns error status codes (4xx, 5xx) for retries to trigger

**Condition not working?**

- Ensure condition function returns a boolean or Promise<boolean>
- Check condition logic matches payload structure
- Add logging to debug condition evaluation

---

**Related**: [AI Agents](09-ai-agents.md) | [API Reference](04-api-reference.md) | [Webhooks](05-webhooks.md)
