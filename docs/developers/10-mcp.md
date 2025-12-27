# MCP

This project includes an MCP (Model Context Protocol) server so external AI agents (for example, **n8n AI Agent**) can retrieve **canonical CMS context**:

- Post types (and their normalized editor config)
- Modules (schema + defaults + constraints)
- Global modules (DB-backed instances with usage counts)

In addition, modules can include optional, structured **`aiGuidance`** (what a module is suited for). MCP exposes this to help agents design page layouts and identify module gaps.

## How MCP relates to Agents and Workflows

There are three complementary AI/automation integration mechanisms in Adonis EOS:

  - **`app/agents/*` (AI Agents)**:
  - Used by the CMS admin UI to run "named agents" (e.g. General Assistant, Graphic Designer, Translator).
  - Agents run directly in your application.
  - They use MCP tools internally to interact with the CMS.
  - Their output is applied into **AI Review** (or similar staging mode) for human approval.
  - See [AI Agents documentation](09-ai-agents.md) for details.

- **`app/workflows/*` (Workflows)**:
  - Event-driven automation system for webhook-based integrations.
  - Used for n8n workflows, Slack notifications, and other external service triggers.
  - Triggered automatically on events (post.published, form.submit, etc.).
  - See [Workflows documentation](05-automation-and-integrations.md) for details.

- **MCP Server (this document)**:
  - Used by external LLM runtimes (Cursor, n8n AI Agent, custom services) to **read context** and perform **safe writes**.
  - MCP tools enforce your intended workflow (AI Review → Review → Approve) so an LLM cannot accidentally mutate Source (live) state.
  - Internal AI agents also use MCP tools to interact with the CMS.

In practice:

- n8n can be both a **workflow target** (webhook endpoint) _and_ an **MCP client** (calling back into Adonis EOS).
- Internal AI agents use MCP tools to create posts, update modules, generate images, etc.

## Running the MCP server

### SSE (recommended for n8n)

Start the MCP server over **SSE**:

```bash
node ace mcp:serve --transport=sse --host=0.0.0.0 --port=8787
```

Or via npm scripts:

```bash
npm run mcp
```

Endpoints:

- **SSE endpoint**: `GET /mcp`
- **Messages endpoint**: `POST /messages?sessionId=...` (handled automatically by MCP clients)
- **Health**: `GET /health`

### stdio (local dev)

Useful for local MCP clients that launch the server as a subprocess:

```bash
node ace mcp:serve --transport=stdio
```

Or:

```bash
npm run mcp:stdio
```

## Authentication (optional)

Set these in your Adonis **`.env`** file for local/dev, or as environment variables in your deployment (systemd, Docker, k8s, etc).

### Bearer token

Set:

- `MCP_AUTH_TOKEN` (client must send `Authorization: Bearer <token>`)

### Generic header

Set:

- `MCP_AUTH_HEADER_NAME`
- `MCP_AUTH_HEADER_VALUE`

## n8n setup

In n8n, add an **MCP Client Tool** node and configure:

- **SSE Endpoint**: `http(s)://<your-host>:8787/mcp`
- **Authentication**: choose Bearer or Header if you enabled auth above

Then connect the MCP Client Tool node to your AI Agent node and allow the tools you want exposed.

## Third-party services (agent implementations)

### n8n (recommended)

Use n8n in one of two patterns:

#### Pattern A — n8n AI Agent uses MCP directly (agent-of-tools)

- n8n AI Agent node is given MCP tools (via MCP Client Tool node).
- The AI Agent calls tools like:
  - `get_allowed_modules_for_post_type`, `get_module_schema`, `get_post_type_config` (includes default module group info)
  - `create_post_ai_review`, `add_module_to_post_ai_review`, `save_post_ai_review`
  - `create_translations_ai_review_bulk`
  - `list_media`, `media_where_used`
- The workflow can end by calling `submit_ai_review_to_review` so a human approves in the CMS.

This is the best fit for “open-ended request → draft content → stage changes”.

#### Pattern B — Adonis EOS triggers a workflow; the workflow uses MCP for context

- You define a workflow in `app/workflows/*` pointing to an n8n webhook (e.g. `Slack Notifier`, `n8n Webhook`).
- The CMS triggers the webhook on events (post.published, form.submit, etc.).
- Inside that n8n workflow, you add an MCP Client Tool node to pull:
  - module schemas, global modules, taxonomy trees, media metadata, etc.
- The webhook can return data or trigger additional automation.

This is the best fit for "event occurs → workflow executes → automation/notification happens".

**Note**: For AI-powered content enhancement that needs to return suggestions, use [AI Agents](09-ai-agents.md) instead. Workflows are for automation and integrations.

### Custom services (Node/Python/etc.)

If you build your own service (instead of n8n), treat MCP as your “CMS tool API”:

- Connect to the MCP server (SSE).
- Call context tools to discover schemas and constraints.
- Use AI-review-safe tools to stage writes.

## Exposed tools

- `list_post_types`
- `get_post_type_config`
- `list_module_groups`
- `get_module_group`
- `list_modules`
- `get_module_schema`
- `get_allowed_modules_for_post_type`
- `list_global_modules`
- `get_global_module`
- `list_posts`
- `get_post_context`
- `create_post_ai_review` (requires `MCP_SYSTEM_USER_ID`)
- `save_post_ai_review`
- `submit_ai_review_to_review`
- `add_module_to_post_ai_review`
- `update_post_module_ai_review`
- `remove_post_module_ai_review`
- `list_post_revisions`
- `get_post_revision`
- `export_post_canonical_json`
- `list_post_translations`
- `create_translation_ai_review`
- `create_translations_ai_review_bulk`
- `list_agents`
- `run_field_agent`
- `create_post_preview_link`
- `list_post_preview_links`
- `revoke_post_preview_link`
- `list_media`
- `get_media`
- `list_media_categories`
- `media_where_used`
- `list_taxonomies`
- `list_taxonomy_terms`
- `get_post_taxonomy_term_ids`
- `set_post_taxonomy_terms_ai_review`
- `suggest_modules_for_layout`

## Module groups (default templates) and AI-created posts

Many post types have a **default module group** (a layout template stored in `module_groups` + `module_group_modules`).

MCP supports editor-parity behavior here:

- `get_post_type_config` includes:
  - `moduleGroups`: available templates for that post type
  - `defaultModuleGroup`: the resolved default template (based on the post type config’s `moduleGroup.name`)
- `create_post_ai_review` will seed modules from the resolved default module group **in AI Review mode**.
- If you want a specific template, pass **either**:
  - `moduleGroupName` (recommended), or
  - `moduleGroupId`
    to `create_post_ai_review`.

### Populating seeded template modules (recommended)

By default, `create_post_ai_review` seeds the **module structure** (from the default module group), but the modules will contain only their **default props** until you update them.

To avoid an extra “update each module” step, you can pass `moduleEdits` to `create_post_ai_review` and the server will apply those edits immediately in **AI Review**.

- For `prose` modules, you can provide `contentMarkdown` and Adonis EOS will convert it to **Lexical JSON** and stage it to the module’s `content` prop.
- You can target seeded modules using either:
  - `postModuleId` (preferred, if known), or
  - `{ type, orderIndex }` (convenient when creating from a module group template).

#### Shortcut: `contentMarkdown`

If you’re creating posts and just want to populate the main body, you can pass a top-level `contentMarkdown` to `create_post_ai_review`.

Adonis EOS will automatically apply it to the **first seeded `prose` module** (AI Review) by converting it to Lexical JSON (even if you also provide other `moduleEdits`, unless you already provided a prose content edit).

#### Troubleshooting: “modules are still defaults”

When `create_post_ai_review` is called with `moduleEdits` (or `contentMarkdown`), the tool response includes:

- `seededModules`: the modules that were seeded from the template (with their `postModuleId`)
- `appliedModuleEdits`: per-edit results (`ok: true/false`) and error messages

If your modules are still defaults, check `appliedModuleEdits` for errors (most commonly: the model didn’t send any edits, or it targeted the wrong module type/orderIndex).

### Locked modules (module-group constraints)

Module groups can mark certain modules as **locked**. Locked modules are structural constraints:

- **They must remain on the post** (cannot be removed).
- **They cannot be reordered**.
- **They must be populated**, just like any other module (agents should provide copy via `moduleEdits` / `contentMarkdown`).

MCP enforces this:

- `remove_post_module_ai_review` rejects removal of locked modules.
- `update_post_module_ai_review` rejects attempts to change `locked` state (agents cannot unlock modules).

## Taxonomy staging semantics

- Agents should **not** write directly to `post_taxonomy_terms`.
- Use `set_post_taxonomy_terms_ai_review` (or include `taxonomyTermIds` in `save_post_ai_review`) to stage taxonomy assignments.
- When AI review is submitted to Review (`submit_ai_review_to_review`), `taxonomyTermIds` is carried into `review_draft`.
- When a human approves Review in the admin UI, taxonomy assignments are applied to `post_taxonomy_terms` (and enforced against post-type taxonomy config + maxSelections).

## Required env for post creation

Creating posts requires a real `users.id` to satisfy `posts.user_id`:

- `MCP_SYSTEM_USER_ID` (numeric)

### Setting up MCP_SYSTEM_USER_ID

The MCP server requires a system user account to attribute AI-generated content operations. We recommend using the dedicated **AI Agent** user created by the seeder:

1. **Run the database seeder** (if not already done):

   ```bash
   node ace db:seed
   ```

2. **Find the AI Agent user id**:
   - The default seeder creates `ai@example.com` (role `ai_agent`) and will **try** to assign ID `5` on a fresh database.
   - On existing databases, the ID may differ (because IDs are already taken).

3. **Set the environment variable** in your `.env` (recommended for clarity):

   ```
   MCP_SYSTEM_USER_ID=<users.id for ai@example.com>
   ```

   The `ai_agent` role is least-privilege for MCP operations:
   - Can create and edit content (staged to AI Review)
   - Cannot publish, approve, or delete content
   - Cannot access admin UI or manage users/settings

4. **Restart the MCP server** to pick up the new environment variable.

**Note:** If `MCP_SYSTEM_USER_ID` is not set, the MCP server will attempt to resolve a system user automatically (preferring `ai@example.com`, then any `ai_agent` user). Explicitly setting `MCP_SYSTEM_USER_ID` is still recommended for deterministic behavior.

### Per-agent attribution (recommended)

If you pass `agentId` to MCP tools (for example `create_post_ai_review`), Adonis EOS will attempt to map that `agentId` to a **dedicated agent user account** (created at boot via `app/agents/*` + `start/agents.ts`).

This gives you accurate authorship such as:

- `Content Enhancer` authored posts it created
- `Translator` authored translation posts it created

If no agent user is found, MCP falls back to the system AI user (`MCP_SYSTEM_USER_ID` / `ai@example.com`).

If you're using an existing database or need to find the user ID, you can list users with:

```bash
node ace tinker
# Then in the REPL:
await User.query().select('id', 'email', 'role')
```

**Security:** The AI Agent role is designed with least-privilege principles. All content created by AI agents is staged to **AI Review** (or **Review** after submission), requiring human approval before publication.

## Updating MCP context (authoring)

MCP in Adonis EOS is **code-derived**: the server reads from your code-first registries and returns structured JSON.

This section explains **where MCP context comes from** and how to update it safely.

### Source of truth

#### Modules

MCP module context is sourced from `app/modules/*` and the module registry (`app/services/module_registry.ts`).

Update these fields inside each module’s `getConfig()`:

- `name`, `description`
- `allowedScopes`, `allowedPostTypes`
- `propsSchema`, `defaultProps`
- **`aiGuidance`** (recommended): structured “when to use / avoid / layout roles / composition notes”

If you add a new module file, it is auto-registered on boot (`start/modules.ts`).

#### Post types

Post type context is sourced from `app/post_types/*` (registered by `start/post_types.ts`).

MCP uses `postTypeConfigService.getUiConfig(postType)` as the normalized config for agents.

#### Taxonomies

Taxonomy context is sourced from your taxonomy registry/service:

- config: `app/taxonomies/*` (registered by `start/taxonomies.ts`)
- runtime lists/trees: `app/services/taxonomy_service.ts`

### Adding suitability guidance (“what module is suited for what?”)

For layout-aware agents (n8n, Cursor, etc.), populate:

```ts
aiGuidance: {
  layoutRoles: ['hero', 'cta'],
  useWhen: ['...'],
  avoidWhen: ['...'],
  compositionNotes: '...'
}
```

This is exposed by MCP via `get_module_schema` / `list_modules`.

### Verifying MCP output (automation)

Use:

```bash
node ace mcp:dump-context --out /tmp/mcp-context.json
```

This dumps **code-derived** context (post types, module schemas, taxonomies) so you can:

- diff changes in PRs
- validate `aiGuidance` is present where expected
- keep external agent implementations aligned with the CMS schema

### Layout planning tool (uses `aiGuidance`)

MCP also includes a deterministic helper tool for layout planning:

- `suggest_modules_for_layout`

It uses `aiGuidance.layoutRoles` + post type constraints to:

- recommend module candidates per layout role
- identify missing roles (gaps where you may want to build a new module)

## Open-Ended Context (agent prompt input)

Some AI agents can accept a freeform user prompt. This is an explicit, opt-in capability:

- Agents declare it via `openEndedContext` in `app/agents/*`
- MCP exposes it in `list_agents` output
- MCP `run_field_agent` accepts `openEndedContext` and forwards it to the agent

Server-side enforcement:

- `openEndedContext` is rejected unless `agent.openEndedContext.enabled === true`
- `maxChars` is enforced when set

**Note**: Workflows do not support open-ended context. They receive structured event payloads.

## CLI: dump MCP context (automation)

To export code-derived MCP context for auditing/diffing:

```bash
node ace mcp:dump-context --out /tmp/mcp-context.json
```
