# AI Agents

Extensible AI agent system for automated content workflows, SEO optimization, and integrations with external services like n8n.

## Overview

Agents are file-based definitions that can:
- Run manually from the post editor dropdown
- Trigger automatically on specific events (publish, review, etc.)
- Integrate with external services via webhooks
- Process and enhance content automatically

## Agent Types

### External Agents
Webhook-based agents that call external services:
- n8n workflows
- OpenAI/Claude APIs
- Custom microservices
- Third-party integrations

### Internal Agents (Planned)
Future support for in-process AI services.

## Creating an Agent

### 1. Generate Agent Scaffold

```bash
node ace make:agent seo-optimizer
```

This creates `app/agents/seo_optimizer.ts`.

### 2. Define Agent Configuration

```typescript
import type { AgentDefinition } from '#types/agent_types'

const SeoOptimizerAgent: AgentDefinition = {
  id: 'seo-optimizer',
  name: 'SEO Optimizer',
  description: 'Automatically generates and optimizes SEO metadata',
  type: 'external',
  enabled: true,

  external: {
    url: process.env.AGENT_SEO_OPTIMIZER_URL || '',
    devUrl: process.env.AGENT_SEO_OPTIMIZER_DEV_URL,
    secret: process.env.AGENT_SEO_OPTIMIZER_SECRET,
    timeout: 30000,
  },

  scopes: [
    { scope: 'dropdown', order: 20, enabled: true },
    { scope: 'post.publish', order: 10, enabled: false },
  ],
}

export default SeoOptimizerAgent
```

### 3. Configure Environment

```env
# .env
AGENT_SEO_OPTIMIZER_URL=https://n8n.example.com/webhook/seo-optimizer
AGENT_SEO_OPTIMIZER_DEV_URL=http://localhost:5678/webhook/seo-optimizer
AGENT_SEO_OPTIMIZER_SECRET=your-secret-key
```

## Agent Scopes

Agents can be triggered in different contexts:

- **`dropdown`** - Manual execution from post editor
- **`post.publish`** - Auto-trigger when publishing
- **`post.approve`** - Trigger when approving changes
- **`post.review.save`** - Trigger when saving for review
- **`post.review.approve`** - Trigger when approving review
- **`post.ai-review.save`** - Trigger when saving AI review
- **`post.ai-review.approve`** - Trigger when approving AI review
- **`form.submit`** - Trigger on form submission

###  Example with Form Filtering

```typescript
scopes: [
  {
    scope: 'form.submit',
    order: 10,
    enabled: true,
    formSlugs: ['contact-form', 'inquiry-form'] // Only these forms
  }
]
```

## Agent Payload

Agents receive the canonical post JSON format:

```json
{
  "post": {
    "type": "blog",
    "locale": "en",
    "slug": "my-post",
    "title": "My Post",
    "excerpt": "Post summary",
    "status": "draft",
    "metaTitle": null,
    "metaDescription": null,
    "canonicalUrl": null,
    "robotsJson": null,
    "jsonldOverrides": null
  },
  "modules": [
    {
      "type": "prose",
      "scope": "local",
      "orderIndex": 0,
      "locked": false,
      "props": {
        "content": { /* Lexical JSON */ }
      },
      "overrides": null,
      "globalSlug": null
    }
  ],
  "translations": [
    { "id": "uuid", "locale": "en" },
    { "id": "uuid", "locale": "es" }
  ],
  "context": {
    "triggeredBy": "dropdown",
    "userId": "uuid"
  }
}
```

## Agent Response

Agents return suggested changes:

```json
{
  "post": {
    "title": "Improved SEO Title - My Post | Brand Name",
    "metaDescription": "Optimized description with keywords and call to action.",
    "metaTitle": "SEO-Optimized Title"
  }
}
```

**Important**: Changes are applied to `review_draft` only, not live content. Users review before publishing.

## Using Agents

### Manual Execution (Dropdown)

1. Open post editor
2. Find "Agents" dropdown in Actions panel
3. Select an agent
4. Click "Run Agent"
5. Agent suggestions appear in Review mode
6. Review and approve changes

### Automatic Execution

Agents configured with event scopes run automatically:

```typescript
scopes: [
  { scope: 'post.publish', order: 10, enabled: true }
]
```

When a post is published, this agent runs automatically.

## Execution Order

Multiple agents on the same scope execute in order:

```typescript
// Agent 1: order 10 (runs first)
// Agent 2: order 20 (runs second)
// Agent 3: order 30 (runs third)
```

Lower numbers run first.

## Security

### RBAC Permission

Agents require the `agents.edit` permission:

```typescript
// Only admins can run agents by default
admin: {
  permissions: ['agents.edit']
}
```

### Webhook Signatures

Outgoing webhooks include HMAC-SHA256 signatures:

```
X-Hub-Signature-256: sha256=<signature>
```

Verify in your webhook handler:

```typescript
const signature = request.headers['x-hub-signature-256']
const payload = JSON.stringify(request.body)
const expected = 'sha256=' + crypto
  .createHmac('sha256', process.env.AGENT_SECRET)
  .update(payload)
  .digest('hex')

if (signature !== expected) {
  throw new Error('Invalid signature')
}
```

## API Endpoints

### List Available Agents

```http
GET /api/agents
```

Returns agents with `dropdown` scope.

### Run Agent

```http
POST /api/posts/:id/agents/:agentId/run
Content-Type: application/json

{
  "context": {
    "note": "Custom context data"
  }
}
```

## Example: n8n SEO Optimizer

### 1. Create n8n Workflow

1. Add Webhook trigger node
2. Add OpenAI node with prompt:
   ```
   Optimize SEO for this blog post:
   Title: {{$json.post.title}}
   Content: {{$json.modules[0].props.content}}
   
   Return JSON with improved metaTitle and metaDescription.
   ```
3. Add Response node with optimized JSON

### 2. Create Agent Definition

```typescript
const SeoAgent: AgentDefinition = {
  id: 'seo-optimizer',
  name: 'SEO Optimizer',
  description: 'Optimizes SEO metadata using AI',
  type: 'external',
  enabled: true,
  external: {
    url: 'https://n8n.example.com/webhook/seo',
    secret: process.env.N8N_WEBHOOK_SECRET,
    timeout: 30000,
  },
  scopes: [
    { scope: 'dropdown', order: 10, enabled: true },
  ],
}

export default SeoAgent
```

### 3. Use in Editor

1. Open a blog post
2. Select "SEO Optimizer" from Agents dropdown
3. Click "Run Agent"
4. Review AI suggestions in Review mode
5. Approve or edit before publishing

## Best Practices

1. **Always use Review mode**: Never modify live content directly
2. **Add timeouts**: Prevent hanging on slow webhooks
3. **Handle errors gracefully**: Return helpful error messages
4. **Log agent runs**: Track successes and failures
5. **Test in development**: Use `devUrl` for local testing
6. **Secure webhooks**: Always verify signatures
7. **Order execution**: Use `order` field for dependent agents
8. **Scope appropriately**: Don't auto-run destructive agents

## Troubleshooting

**Agent not appearing in dropdown?**
- Check `enabled: true` and `scopes` includes `dropdown`
- Verify user has `agents.edit` permission

**Webhook timing out?**
- Increase `timeout` value
- Check webhook URL is accessible
- Test with curl/Postman first

**Changes not applying?**
- Agents update `review_draft`, not live content
- Switch to Review tab to see changes
- Check agent response format matches expected schema

---

**Related**: [API Reference](/docs/for-developers/api-reference) | [Webhooks](/docs/for-developers/webhooks)

