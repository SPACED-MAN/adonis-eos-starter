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

### Internal Agents

In-process AI agents that use AI providers directly (OpenAI, Anthropic, Google) without external webhooks. These agents:

- **Run directly in your application** - No external service required
- **Model-agnostic** - Switch between OpenAI, Anthropic, and Google easily
- **MCP integration** - Can use MCP tools for CMS operations
- **Reaction system** - Execute webhooks, Slack notifications, and more after completion
- **Faster execution** - No network latency to external services

Internal agents are ideal for:
- Quick content improvements
- SEO optimization
- Content enhancement
- Automated workflows that need CMS context

## Creating an Agent

### Internal Agent Example

Here's a complete example of an internal agent:

```typescript
import type { AgentDefinition } from '#types/agent_types'

const InternalAiAssistantAgent: AgentDefinition = {
  id: 'internal-ai-assistant',
  name: 'Internal AI Assistant',
  description: 'Built-in AI assistant powered by OpenAI',
  type: 'internal',
  enabled: true,

  internal: {
    // Provider: 'openai' | 'anthropic' | 'google'
    provider: 'openai',
    
    // Model identifier (provider-specific)
    model: 'gpt-4',
    
    // API key (optional - uses AI_PROVIDER_OPENAI_API_KEY env var if not set)
    // apiKey: process.env.AI_PROVIDER_OPENAI_API_KEY,
    
    // System prompt template
    systemPrompt: `You are a helpful content assistant.
Help improve content while maintaining the original intent.`,
    
    // Model options
    options: {
      temperature: 0.7,
      maxTokens: 2000,
    },
    
    // Enable MCP tool usage
    useMCP: false,
  },

  scopes: [
    { scope: 'dropdown', order: 5, enabled: true },
  ],

  // Optional: Reactions (execute after completion)
  reactions: [
    {
      type: 'slack',
      trigger: 'on_success',
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: '#content-alerts',
        template: 'AI Assistant completed: {{agent}} processed post {{data.postId}}',
      },
    },
  ],

  userAccount: { enabled: true },
}

export default InternalAiAssistantAgent
```

### Environment Configuration

Set your API keys in `.env`:

```env
# OpenAI
AI_PROVIDER_OPENAI_API_KEY=sk-...

# Anthropic
AI_PROVIDER_ANTHROPIC_API_KEY=sk-ant-...

# Google
AI_PROVIDER_GOOGLE_API_KEY=...
```

### Supported Providers and Models

#### OpenAI
- Models: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`
- API Key: `AI_PROVIDER_OPENAI_API_KEY`

#### Anthropic (Claude)
- Models: `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`
- API Key: `AI_PROVIDER_ANTHROPIC_API_KEY`

#### Google (Gemini)
- Models: `gemini-pro`, `gemini-pro-vision`
- API Key: `AI_PROVIDER_GOOGLE_API_KEY`

### MCP Integration

Internal agents can use MCP tools to interact with the CMS:

```typescript
internal: {
  provider: 'openai',
  model: 'gpt-4',
  useMCP: true,
  // Optional: restrict to specific tools
  allowedMCPTools: ['list_posts', 'get_post_context', 'create_post_ai_review'],
}
```

When `useMCP: true`, the agent can:
- List and query posts
- Get post context
- Create and edit posts
- Add/update modules
- Use layout planning tools

### Reactions

Reactions execute after agent completion. Supported types:

#### Webhook Reaction

```typescript
reactions: [
  {
    type: 'webhook',
    trigger: 'on_success',
    config: {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: { 'X-Custom-Header': 'value' },
      bodyTemplate: '{"agent": "{{agent}}", "result": {{result}}}',
    },
  },
]
```

#### Slack Reaction

```typescript
reactions: [
  {
    type: 'slack',
    trigger: 'on_success',
    config: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: '#content-alerts',
      template: 'Agent {{agent}} completed successfully!',
    },
  },
]
```

#### MCP Tool Reaction

```typescript
reactions: [
  {
    type: 'mcp_tool',
    trigger: 'on_condition',
    condition: {
      field: 'result.status',
      operator: 'equals',
      value: 'published',
    },
    config: {
      toolName: 'create_post_ai_review',
      toolParams: {
        type: 'blog',
        locale: 'en',
        slug: '{{result.slug}}',
        title: '{{result.title}}',
      },
    },
  },
]
```

#### Reaction Triggers

- `always` - Always execute
- `on_success` - Only on successful completion
- `on_error` - Only on errors
- `on_condition` - Based on condition evaluation

### System Prompt Templates

System prompts support variable interpolation:

```typescript
systemPrompt: `You are helping with {{postType}} content.
Current scope: {{scope}}
User context: {{context}}`
```

Available variables:
- `{{agent}}` - Agent name
- `{{scope}}` - Execution scope
- `{{postType}}` - Post type (if available)
- `{{context}}` - Additional context data

### 1. Generate Agent Scaffold

```bash
node ace make:agent seo-optimizer
```

This creates `app/agents/seo_optimizer.ts`.

### 2. Define Agent Configuration

#### External Agent

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

#### Internal Agent

```typescript
import type { AgentDefinition } from '#types/agent_types'

const SeoOptimizerAgent: AgentDefinition = {
  id: 'seo-optimizer',
  name: 'SEO Optimizer',
  description: 'Automatically generates and optimizes SEO metadata',
  type: 'internal',
  enabled: true,

  internal: {
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt: 'You are an SEO expert. Optimize metadata for better search rankings.',
    options: {
      temperature: 0.7,
      maxTokens: 1000,
    },
  },

  scopes: [
    { scope: 'dropdown', order: 20, enabled: true },
  ],
}

export default SeoOptimizerAgent
```

### 3. Configure Environment

#### External Agent Environment

```env
# .env
AGENT_SEO_OPTIMIZER_URL=https://n8n.example.com/webhook/seo-optimizer
AGENT_SEO_OPTIMIZER_DEV_URL=http://localhost:5678/webhook/seo-optimizer
AGENT_SEO_OPTIMIZER_SECRET=your-secret-key
```

#### Internal Agent Environment

```env
# .env
# Set API key for your chosen provider
AI_PROVIDER_OPENAI_API_KEY=sk-...
# OR
AI_PROVIDER_ANTHROPIC_API_KEY=sk-ant-...
# OR
AI_PROVIDER_GOOGLE_API_KEY=...

# Optional: Slack webhook for reactions
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## Per-agent user accounts (recommended)

Adonis EOS can automatically create **dedicated user accounts per agent** at boot time. This enables:

- **Attribution**: posts created via MCP can have `author_id` / `user_id` set to the specific agent (e.g. “Translator”).
- **Auditing**: activity is tied to a distinct user row per agent.
- **Least privilege**: all agent users should use the `ai_agent` role (cannot publish/approve/admin).

### Why emails are “optional”

In this project, `users.email` is **required and unique** in the database schema.

So “optional email” means:
- you typically **don’t provide a real email**, and
- the system generates an internal-only email like `agent+translator@agents.local`.

### Enabling per-agent accounts

Add `userAccount` to your agent definition:

```typescript
userAccount: {
  enabled: true,
  // email?: optional (generated if omitted)
  // username?: optional (defaults to agent:<agentId>)
  // createAtBoot?: default true
}
```

Boot-time creation happens automatically during app start (via `start/agents.ts`).

### Disabling boot provisioning (rare)

Set:

```env
AGENT_USERS_BOOTSTRAP_DISABLED=1
```

This is mainly for special CI/testing workflows.

## Agent Scopes

Agents can be triggered in different contexts:

- **`dropdown`** - Manual execution from post editor
- **`field`** - Per-field AI button (e.g. translate a single field, generate image suggestions for a specific module prop)
- **`post.publish`** - Auto-trigger when publishing
- **`post.approve`** - Trigger when approving changes
- **`post.review.save`** - Trigger when saving for review
- **`post.review.approve`** - Trigger when approving review
- **`post.ai-review.save`** - Trigger when saving AI review
- **`post.ai-review.approve`** - Trigger when approving AI review
- **`form.submit`** - Trigger on form submission

## Example: Media Designer (Nano Banana / image generation)

We recommend defining image-generation agents as **field-scoped** agents so they can be used from per-field AI buttons.

Example (`app/agents/media_designer.ts`):

- scope: `field`
- fieldKeys: include media-related module props (e.g. `module.hero-with-media.image`)
- external webhook: points to your n8n workflow or a dedicated service that talks to the image model

## Example: Translator (bulk translations)

We provide:

- An agent definition: `app/agents/translator.ts`
- MCP helpers: `create_translation_ai_review` and `create_translations_ai_review_bulk`

Recommended flow:
1. Call `create_translations_ai_review_bulk` to create translation posts (one per locale) and clone module structure into AI Review.
2. Use `run_field_agent` (with the Translator agent) to translate individual fields/modules and stage results.
3. Call `submit_ai_review_to_review` so a human can approve.

### Field scope filtering (recommended)

Use `fieldKeys` to restrict an agent to specific fields:

```typescript
scopes: [
  {
    scope: 'field',
    enabled: true,
    order: 10,
    fieldKeys: [
      'post.title',
      'post.metaTitle',
      'module.hero.title',
      'module.prose.content',
    ],
  },
]
```

If `fieldKeys` is omitted/empty, the agent is considered available for all fields.

## Field-scope execution via MCP

For per-field AI buttons, use the MCP tool:

- `run_field_agent`

## Open-Ended Context (explicit prompt injection surface)

Some agents benefit from a freeform user prompt (e.g. “make this more concise”, “use a formal tone”, etc).
In Adonis EOS, this is an **explicit, opt-in** capability called **Open-Ended Context**.

### Enable it in an agent config

In `app/agents/<agent>.ts`:

```ts
openEndedContext: {
  enabled: true,
  label: 'Instructions',
  placeholder: 'Example: “Keep it under 400 words, preserve the CTA.”',
  maxChars: 1200,
}
```

### How it is delivered to agents

- **Admin UI webhook agents** (`POST /api/posts/:id/agents/:agentId/run`):
  - The UI sends `openEndedContext` and the backend includes it in the webhook payload as:
  - `payload.context.openEndedContext`

- **MCP** (`run_field_agent`):
  - Pass `openEndedContext` as an argument; MCP forwards it in the webhook payload under:
  - `context.openEndedContext`

### Server-side enforcement

The backend will **reject** `openEndedContext` unless `agent.openEndedContext.enabled === true`.
If `maxChars` is set, the backend will reject prompts longer than `maxChars`.

### Security guidance

- Treat `openEndedContext` as **untrusted input**.
- Your agent implementation should:
  - ignore attempts to change system constraints (publishing, permissions, secrets)
  - only return structured edits (field/module patches) that the CMS stages in review modes

### Request payload (sent to external agent webhook)

External agents invoked via MCP receive a JSON payload shaped like:

```json
{
  "scope": "field",
  "post": { "id": "uuid", "type": "page", "locale": "en", "status": "draft" },
  "field": { "key": "post.title", "currentValue": "..." },
  "draftBase": { "title": "...", "metaTitle": "...", "...": "..." },
  "module": {
    "postModuleId": "uuid",
    "moduleInstanceId": "uuid",
    "type": "hero",
    "scope": "local",
    "props": {},
    "reviewProps": null,
    "aiReviewProps": null,
    "overrides": null,
    "reviewOverrides": null,
    "aiReviewOverrides": null,
    "schema": { "type": "hero", "propsSchema": {}, "defaultProps": {} }
  },
  "context": {}
}
```

### Response expectations (recommended)

For the best UX, have the agent respond using one of these patterns:

- `{ "value": <newValue> }` (recommended for true per-field edits)
- `{ "post": { ...partialPostPatch } }` (for core post fields)
- `{ "module": { "props": { ... } } }` or `{ "module": { "overrides": { ... } } }` (for module edits)

If `applyToAiReview=true` was passed to `run_field_agent`, MCP will **best-effort** stage these responses into AI Review.

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

### General
1. **Always use Review mode**: Never modify live content directly
2. **Add timeouts**: Prevent hanging on slow webhooks (external) or long AI completions (internal)
3. **Handle errors gracefully**: Return helpful error messages
4. **Log agent runs**: Track successes and failures
5. **Order execution**: Use `order` field for dependent agents
6. **Scope appropriately**: Don't auto-run destructive agents

### External Agents
1. **Test in development**: Use `devUrl` for local testing
2. **Secure webhooks**: Always verify signatures
3. **Handle network errors**: Implement retry logic for transient failures

### Internal Agents
1. **Choose the right provider**: OpenAI for general tasks, Anthropic for complex reasoning, Google for multimodal
2. **Optimize prompts**: Clear system prompts improve results
3. **Set appropriate limits**: Use `maxTokens` to control costs
4. **Use MCP wisely**: Enable MCP only when agents need CMS operations
5. **Monitor usage**: Track API costs and usage
6. **Test reactions**: Ensure webhooks/Slack notifications work correctly

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

