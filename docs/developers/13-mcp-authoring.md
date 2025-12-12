# MCP Authoring (Keeping MCP Context Up To Date)

MCP in Adonis EOS is **code-derived**: the server reads from your code-first registries and returns structured JSON.

This document explains **where MCP context comes from** and how to update it safely.

## What MCP uses as “source of truth”

### Modules

MCP module context is sourced from `app/modules/*` and the module registry (`app/services/module_registry.ts`).

Update these fields inside each module’s `getConfig()`:

- `name`, `description`
- `allowedScopes`, `allowedPostTypes`
- `propsSchema`, `defaultProps`
- **`aiGuidance`** (recommended): structured “when to use / avoid / layout roles / composition notes”

If you add a new module file, it is auto-registered on boot (`start/modules.ts`).

### Post types

Post type context is sourced from `app/post_types/*` (registered by `start/post_types.ts`).

MCP uses `postTypeConfigService.getUiConfig(postType)` as the normalized config for agents.

### Taxonomies

Taxonomy context is sourced from your taxonomy registry/service:

- config: `app/taxonomies/*` (registered by `start/taxonomies.ts`)
- runtime lists/trees: `app/services/taxonomy_service.ts`

## Adding suitability guidance (“what module is suited for what?”)

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

## Verifying MCP output (automation)

### Dump the current MCP context to JSON

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

### MCP tools to inspect module guidance

From MCP clients you can call:

- `list_modules`
- `get_module_schema`

## Recommended workflow for updates

- **When adding a new module**: fill `description` + `aiGuidance` as part of the module PR.
- **When changing props**: update both `propsSchema` and `defaultProps`.
- **When changing what a post type allows**: update `app/post_types/<type>.ts` and re-check allowed modules via MCP.


