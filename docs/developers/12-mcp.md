# MCP (Model Context Protocol) for AI Agents

This project includes an MCP server so external AI agents (for example, **n8n AI Agent**) can retrieve **canonical CMS context**:

- Post types (and their normalized editor config)
- Modules (schema + defaults + constraints)
- Global modules (DB-backed instances with usage counts)

In addition, modules can include optional, structured **`aiGuidance`** (what a module is suited for). MCP exposes this to help agents design page layouts and identify module gaps.

## How MCP relates to `app/agents/*` (webhook agents)

There are two complementary AI integration mechanisms in Adonis EOS:

- **`app/agents/*` (Agent Definitions + Webhooks)**:
  - Used by the CMS admin UI to run “named agents” (e.g. Content Enhancer, Media Designer, Translator).
  - Agents are typically **webhook-based** (often backed by n8n workflows).
  - Their output is applied into **Review** (or a similar staging mode) for human approval.

- **MCP Server (this document)**:
  - Used by external LLM runtimes (Cursor, n8n AI Agent, custom services) to **read context** and perform **safe writes**.
  - MCP tools enforce your intended workflow (AI Review → Review → Approve) so an LLM cannot accidentally mutate Approved state.

In practice:
- n8n can be both an **agent implementation** (webhook target) *and* an **MCP client** (calling back into Adonis EOS).

## Running the MCP server

### SSE (recommended for n8n)

Start the MCP server over **SSE**:

```bash
node ace mcp:serve --transport=sse --host=0.0.0.0 --port=8787
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
  - `get_allowed_modules_for_post_type`, `get_module_schema`
  - `create_post_ai_review`, `add_module_to_post_ai_review`, `save_post_ai_review`
  - `create_translations_ai_review_bulk`
  - `list_media`, `media_where_used`
- The workflow can end by calling `submit_ai_review_to_review` so a human approves in the CMS.

This is the best fit for “open-ended request → draft content → stage changes”.

#### Pattern B — Adonis EOS runs a webhook agent; the webhook uses MCP for context

- You define an agent in `app/agents/*` pointing to an n8n webhook (e.g. `Media Designer`, `Translator`).
- The CMS calls the webhook (agent execution).
- Inside that n8n workflow, you add an MCP Client Tool node to pull:
  - module schemas, global modules, taxonomy trees, media metadata, etc.
- The webhook returns a structured suggestion payload (either post patch or field/module patch).

This is the best fit for “editor clicks Run Agent → agent suggests changes → staged for review”.

### Custom services (Node/Python/etc.)

If you build your own service (instead of n8n), treat MCP as your “CMS tool API”:
- Connect to the MCP server (SSE).
- Call context tools to discover schemas and constraints.
- Use AI-review-safe tools to stage writes.

## Exposed tools

- `list_post_types`
- `get_post_type_config`
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

## Taxonomy staging semantics

- Agents should **not** write directly to `post_taxonomy_terms`.
- Use `set_post_taxonomy_terms_ai_review` (or include `taxonomyTermIds` in `save_post_ai_review`) to stage taxonomy assignments.
- When AI review is submitted to Review (`submit_ai_review_to_review`), `taxonomyTermIds` is carried into `review_draft`.
- When a human approves Review in the admin UI, taxonomy assignments are applied to `post_taxonomy_terms` (and enforced against post-type taxonomy config + maxSelections).

## Required env for post creation

Creating posts requires a real `users.id` to satisfy `posts.user_id`:

- `MCP_SYSTEM_USER_ID` (numeric)

## Updating MCP context (authoring)

See: [MCP Authoring](/docs/for-developers/mcp-authoring)

## CLI: dump MCP context (automation)

To export code-derived MCP context for auditing/diffing:

```bash
node ace mcp:dump-context --out /tmp/mcp-context.json
```


