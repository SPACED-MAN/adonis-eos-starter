# CLI Scaffolding

Code-first makers to scaffold common CMS artifacts.

## Post Types
- Command: `node ace make:post-type "Blog"` (alias: `make:post_type`)
- Flags:
  - `--pattern` (default `/{locale}/{post_type}/{slug}`) – URL pattern template.
- Output: `app/post_types/blog.ts` with starter config (fields, module group/template defaults, URL patterns).

## Modules
- Command: `node ace make:module "Hero With Media"`
- Output: Backend module boilerplate and frontend stub for a new module component.

## Roles
- Command: `node ace make:role "Publisher"`
- Output: Role definition scaffold in `app/roles/`.

## Agents
- Command: `node ace make:agent "Seo Optimizer"`
- Output: AI agent scaffold in `app/agents/`.

## Menus
- Command: `node ace make:menu "Footer"`
- Output: Menu scaffold registration file.

## MCP (Model Context Protocol)
- Command: `node ace mcp:serve`
- Purpose: Serve CMS context (post types, module schemas, global modules) to external AI agents via MCP.
- See: `docs/developers/12-mcp.md`

## Post Types (duplicate detection)
- If a file exists, the command is skipped gracefully (no overwrite).

## Taxonomies (Categories/Tags)
- Command:
  ```bash
  node ace make:taxonomy "Blog Categories" \
    --hierarchical \
    --free-tagging=false \
    --maxSelections=unlimited
  ```
- Flags:
  - `--hierarchical` (boolean) – enable nesting + reorder.
  - `--free-tagging` (boolean) – allow inline term creation in the post editor.
  - `--maxSelections` (number or `unlimited`) – cap terms per post.
- Output: `app/taxonomies/<slug>.ts` config; boot (`start/taxonomies.ts`) syncs DB rows on startup.

