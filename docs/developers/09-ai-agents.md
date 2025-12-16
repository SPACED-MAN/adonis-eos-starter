# AI Agents

AI-powered content enhancement system for automated content workflows, SEO optimization, and intelligent content assistance.

## Overview

Agents are file-based definitions that can:

- Run manually from the post editor dropdown
- Trigger automatically on specific events (publish, review, etc.)
- Process and enhance content automatically using AI
- Use MCP tools to interact with the CMS

**Note**: Agents are now **internal-only** (AI-powered). For webhook-based automation (n8n, Slack notifications, etc.), use the [Workflows system](/docs/developers/workflows).

## Agent Types

### Internal Agents (AI-Powered)

In-process AI agents that use AI providers directly (OpenAI, Anthropic, Google, Nano Banana) without external webhooks. These agents:

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

  scopes: [{ scope: 'dropdown', order: 5, enabled: true }],

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

# Google (Gemini)
AI_PROVIDER_GOOGLE_API_KEY=...

# Nano Banana (Gemini Pro API via Nano Banana service)
AI_PROVIDER_NANOBANANA_API_KEY=your-nanobanana-api-key
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

#### Nano Banana (Gemini Pro)

- Models: `gemini-pro`
- API Key: `AI_PROVIDER_NANOBANANA_API_KEY`
- Description: Provides access to Gemini Pro API via Nano Banana service

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

#### MCP Tool RBAC (Role-Based Access Control)

**Security Feature**: Agents can be restricted to specific MCP tools using the `allowedMCPTools` configuration. This ensures agents only have access to the tools they need for their specific purpose.

**Where to Configure:**

In your agent file (`app/agents/your_agent.ts`), add `allowedMCPTools` inside the `internal` configuration block:

```typescript
const YourAgent: AgentDefinition = {
  id: 'your-agent',
  name: 'Your Agent',
  type: 'internal',
  enabled: true,

  internal: {
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt: '...',
    options: { ... },

    // Enable MCP tool usage
    useMCP: true,

    // Configure tool access here:
    // Empty array [] = all tools available
    // Specify array = only these tools allowed
    allowedMCPTools: ['list_posts', 'get_post_context'], // Example: restricted access
    // OR
    // allowedMCPTools: [], // Full access to all tools
  },

  // ... rest of agent config
}
```

**Real Examples from Codebase:**

1. **Graphic Designer** (`app/agents/graphic_designer.ts`) - Restricted to media tools only:

   ```typescript
   internal: {
     useMCP: true,
     allowedMCPTools: ['list_media', 'get_media', 'generate_image'],
   }
   ```

2. **General Assistant** (`app/agents/general_assistant.ts`) - Full access:
   ```typescript
   internal: {
     useMCP: true,
     allowedMCPTools: [], // Empty = all tools
   }
   ```

**How It Works:**

- **If `allowedMCPTools` is empty or undefined**: Agent has access to ALL MCP tools (default behavior)
- **If `allowedMCPTools` is specified**: Agent can ONLY use the tools listed in the array
- **Enforcement**: The system enforces these restrictions at two levels:
  1. **System Prompt**: Only allowed tools are shown to the AI in the prompt
  2. **Execution**: Any attempt to call a non-allowed tool is rejected with an error

**Example: Restricted Agent (Graphic Designer)**

The Graphic Designer agent is restricted to only media-related tools:

```typescript
internal: {
  provider: 'nanobanana',
  model: 'gemini-2.5-flash',
  useMCP: true,
  // Only allow media-related tools - cannot create posts or modify content
  allowedMCPTools: ['list_media', 'get_media', 'generate_image'],
}
```

This agent can:

- ✅ List media items
- ✅ Get media details
- ✅ Generate images via DALL-E

This agent cannot:

- ❌ Create new posts (`create_post_ai_review`)
- ❌ Modify existing posts (`save_post_ai_review`, `update_post_module_ai_review`)
- ❌ Access post data (`list_posts`, `get_post_context`)

**Example: Full Access Agent (General Assistant)**

The General Assistant has full access to all MCP tools:

```typescript
internal: {
  provider: 'openai',
  model: 'gpt-4',
  useMCP: true,
  // Empty array = all tools available
  allowedMCPTools: [],
}
```

**Available MCP Tools:**

- **Post Management**: `list_posts`, `get_post_context`, `create_post_ai_review`, `save_post_ai_review`
- **Module Management**: `add_module_to_post_ai_review`, `update_post_module_ai_review`, `remove_post_module_ai_review`
- **Media Management**: `list_media`, `get_media`, `search_media`, `generate_image`
  - `search_media`: Search existing media by alt text, description, filename, or category. Use this to find existing images before generating new ones.
  - `generate_image`: Generate new images via DALL-E. Only use when explicitly requested or when no suitable existing image is found.
- **Configuration**: `list_post_types`, `get_post_type_config`, `list_modules`, `get_module_schema`
- **Layout Planning**: `suggest_modules_for_layout`

**Best Practices:**

1. **Principle of Least Privilege**: Only grant agents the minimum tools they need
2. **Document Restrictions**: Comment why certain tools are restricted
3. **Test Restrictions**: Verify agents cannot access unauthorized tools
4. **Review Regularly**: As new tools are added, review agent permissions

**Security Notes:**

- Tool restrictions are enforced server-side and cannot be bypassed
- Unauthorized tool calls return an error in the tool results
- The AI is only informed about tools it has access to, reducing the chance of attempting unauthorized calls

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

Agents are now internal-only (AI-powered). For webhook-based automation, see the [Workflows documentation](/docs/developers/workflows).

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

    // Enable MCP tool usage (allows agent to use CMS tools)
    useMCP: true,

    // MCP Tool Access Control (RBAC)
    // - If empty array []: Agent has access to ALL MCP tools (default)
    // - If specified: Agent can ONLY use the tools listed in the array
    // Example: Restrict to only SEO-related tools
    allowedMCPTools: ['get_post_context', 'save_post_ai_review'],
  },

  scopes: [{ scope: 'dropdown', order: 20, enabled: true }],
}

export default SeoOptimizerAgent
```

### 3. Configure Environment

```env
# .env
# Set API key for your chosen provider
AI_PROVIDER_OPENAI_API_KEY=sk-...
# OR
AI_PROVIDER_ANTHROPIC_API_KEY=sk-ant-...
# OR
AI_PROVIDER_GOOGLE_API_KEY=...
# OR
AI_PROVIDER_NANOBANANA_API_KEY=your-nanobanana-api-key

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

- **`dropdown`** - Manual execution from post editor dropdown
- **`global`** - Global agent accessible via floating brain icon button (lower right of viewport)
- **`field`** - Per-field AI button (e.g. translate a single field, generate image suggestions for a specific module prop)
  - Can be filtered by `fieldTypes` (e.g., `['media']`) to only appear for specific field types
  - Can be filtered by `fieldKeys` to only appear for specific field paths
- **`post.publish`** - Auto-trigger when publishing
- **`post.approve`** - Trigger when approving changes
- **`post.review.save`** - Trigger when saving for review
- **`post.review.approve`** - Trigger when approving review
- **`post.ai-review.save`** - Trigger when saving AI review
- **`post.ai-review.approve`** - Trigger when approving AI review
- **`form.submit`** - Trigger on form submission

### Global Scope

Global agents are accessible via a floating brain icon button in the lower right of the viewport. They don't require a post context and can be used for:

- Creating new posts
- General content assistance
- System-wide operations

Example:

```typescript
scopes: [{ scope: 'global', order: 5, enabled: true }]
```

### Field Scope with Field Types

Field-scoped agents can be restricted to specific field types (e.g., `media` fields):

```typescript
scopes: [
  {
    scope: 'field',
    order: 10,
    enabled: true,
    fieldTypes: ['media'], // Only available for media field types
  },
]
```

This is useful for specialized agents like the Graphic Designer that should only appear when editing media fields.

## Example: Graphic Designer (Image Generation)

We recommend defining image-generation agents as **field-scoped** agents so they can be used from per-field AI buttons.

Example (`app/agents/graphic_designer.ts`):

- scope: `field`
- fieldTypes: `['media']` - Only appears for media field types
- Uses MCP tools: `generate_image` (DALL-E) and `search_media` for finding existing images

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
    fieldKeys: ['post.title', 'post.metaTitle', 'module.hero.title', 'module.prose.content'],
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

### Request payload (for field-scoped agents)

Field-scoped agents receive context about the field being edited:

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

### Example with Form Filtering

```typescript
scopes: [
  {
    scope: 'form.submit',
    order: 10,
    enabled: true,
    formSlugs: ['contact-form', 'inquiry-form'], // Only these forms
  },
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
        "content": {
          /* Lexical JSON */
        }
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
scopes: [{ scope: 'post.publish', order: 10, enabled: true }]
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

### RBAC Permissions

Agents require specific permissions based on their scope:

- **`agents.global`** - Permission to use global-scoped agents (floating brain icon)
- **`agents.dropdown`** - Permission to use dropdown-scoped agents (post editor)
- **`agents.field`** - Permission to use field-scoped agents (per-field AI buttons)

The general `agents.edit` permission is also checked for backward compatibility:

```typescript
// Admin role with all agent permissions
admin: {
  permissions: ['agents.edit', 'agents.global', 'agents.dropdown', 'agents.field']
}

// Editor role with limited agent access
editor: {
  permissions: ['agents.dropdown', 'agents.field']
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
const expected =
  'sha256=' + crypto.createHmac('sha256', process.env.AGENT_SECRET).update(payload).digest('hex')

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

## Example: SEO Optimizer Agent

### 1. Create Agent Definition

```typescript
import type { AgentDefinition } from '#types/agent_types'

const SeoAgent: AgentDefinition = {
  id: 'seo-optimizer',
  name: 'SEO Optimizer',
  description: 'Optimizes SEO metadata using AI',
  type: 'internal',
  enabled: true,

  internal: {
    provider: 'openai',
    model: 'gpt-4',
    systemPrompt: `You are an SEO expert. Analyze the post content and suggest optimized metaTitle and metaDescription that improve search rankings while accurately representing the content.`,
    options: {
      temperature: 0.7,
      maxTokens: 500,
    },
    useMCP: true,
    allowedMCPTools: ['get_post_context', 'save_post_ai_review'],
  },

  scopes: [{ scope: 'dropdown', order: 10, enabled: true }],
}

export default SeoAgent
```

### 2. Use in Editor

1. Open a blog post
2. Select "SEO Optimizer" from Agents dropdown
3. Click "Run Agent"
4. Review AI suggestions in Review mode
5. Approve or edit before publishing

**Note**: For n8n-based SEO optimization workflows, use the [Workflows system](/docs/developers/workflows) instead.

## Best Practices

### General

1. **Always use Review mode**: Never modify live content directly
2. **Add timeouts**: Prevent hanging on slow webhooks (external) or long AI completions (internal)
3. **Handle errors gracefully**: Return helpful error messages
4. **Log agent runs**: Track successes and failures
5. **Order execution**: Use `order` field for dependent agents
6. **Scope appropriately**: Don't auto-run destructive agents

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

**Agent execution failing?**

- Check API keys are set correctly in `.env`
- Verify the AI provider is accessible
- Check model name is correct for the provider

**Changes not applying?**

- Agents update `review_draft`, not live content
- Switch to Review tab to see changes
- Check agent response format matches expected schema

---

**Related**: [Workflows](/docs/developers/workflows) | [MCP (Model Context Protocol)](/docs/developers/mcp) | [API Reference](/docs/developers/api-reference)
