# Review Workflow

This project supports **staged editing** and auditability:

- **Source (Live)**: canonical content (previously called “Approved” in the UI)
- **Review**: human review draft
- **AI Review**: agent-only staging area
- **Revisions**: database snapshots for audit/rollback

## Where data lives (DB columns)

The `posts` table stores draft payloads:

- `review_draft` (JSON) — human review content
- `ai_review_draft` (JSON) — agent staging content

Module data is stored separately:

- `module_instances.props` (source/live)
- `module_instances.review_props` / `module_instances.ai_review_props` (staged props for global/local modules)
- `post_modules.overrides` (source/live per-post overrides)
- `post_modules.review_overrides` / `post_modules.ai_review_overrides` (staged overrides)
- Structural flags:
  - `post_modules.review_added` / `review_deleted`
  - `post_modules.ai_review_added` / `ai_review_deleted`

## Key services/actions

- Revisions: `app/services/revision_service.ts`
- Post drafts + approvals: `app/controllers/posts/posts_crud_controller.ts`
- Module ops: `app/controllers/posts/posts_modules_controller.ts`
- Module actions:
  - `app/actions/posts/add_module_to_post.ts`
  - `app/actions/posts/update_post_module.ts`

## Promotion flow (high level)

### Source → Review

Editors save partial changes into `review_draft` (and module review_* fields).

### AI Review (agents)

Agents must stage changes into `ai_review_draft` / `ai_review_*` fields.

Agents should **not** mutate Source or Review content directly.

### AI Review → Review

When agents submit AI Review, the system:

- merges AI Review into Review (draft + module staging)
- clears AI Review staging

This ensures humans always approve “Review” content.

### Review → Source

When a human approves Review in the admin UI:

- Review draft content is promoted into source/live fields
- module staging is promoted
- taxonomy assignments are applied if provided (see MCP docs for staging behavior)

## Revisions

Revisions are stored in `post_revisions` with a mode (e.g. `review`, `ai-review`).
They are used for:

- audit history
- rollback / inspection

## Developer notes

- Keep “approval” logic in one place (promotion functions), so MCP + UI stay consistent.
- Prefer deterministic merges (patches) over freeform replaces.


