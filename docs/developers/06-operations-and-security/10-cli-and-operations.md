# CLI & Operations

Adonis EOS includes a suite of CLI tools and database utilities for development and production maintenance.

---

## 1. CLI Commands (Makers)

Use these commands to scaffold new CMS artifacts following the code-first approach.

### Artifact Scaffolding

| Command                          | Output                     |
| :------------------------------- | :------------------------- |
| `node ace make:post-type "Blog"` | `app/post_types/blog.ts`   |
| `node ace make:module "Hero"`    | Backend & Frontend stubs   |
| `node ace make:role "Publisher"` | `app/roles/publisher.ts`   |
| `node ace make:field-type "Stars"`| `app/fields/stars.ts`      |
| `node ace make:agent "SEO"`      | `app/agents/seo.ts`        |
| `node ace make:taxonomy "Tags"`  | `app/taxonomies/tags.ts`   |
| `node ace make:menu "Main"`      | Menu registration scaffold |

### Maintenance Utilities

- **`node ace mcp:dump-context`**: Exports code-derived context for auditing/diffing.
- **`node ace mcp:serve`**: Starts the Model Context Protocol (MCP) server for AI integration.

### Maintenance Scripts

These utilities are intended for use by developers or Cursor agents and are located in the `scripts/` directory. Run them using `tsx`.

- **`tsx scripts/audit_internal_links.ts`**: Scans content for hardcoded URLs and suggests post references.
- **`tsx scripts/check_user.ts <email> [password]`**: Checks user existence and optionally verifies password.
- **`tsx scripts/debug_db.ts`**: Low-level database inspection script.

### Administrative Operations

- **Populate Canonical URLs**: Accessible via the Admin UI under **Settings > SEO** (or via `POST /api/seo/canonical-urls/populate`). This backfills canonical URLs based on current URL patterns.

---

## 2. Export & Import Pipeline

A first-class JSON-based pipeline for moving content between environments and creating backups.

### Content Seeding (Seeders)

- **Development**: `index_seeder.ts` imports `development-export.json` and re-seeds documentation from markdown.
- **Production**: Used for the initial setup or content promotion via `production-export.json`.

### Import Strategies

| Strategy      | Behavior                                           |
| :------------ | :------------------------------------------------- |
| **Replace**   | Clears tables then inserts new rows (Destructive). |
| **Merge**     | Inserts new rows; skips conflicts.                 |
| **Overwrite** | Updates existing rows by ID and inserts new ones.  |
| **Skip**      | Only imports if the table is empty.                |

### Admin Interface

Database operations are accessible via the Admin UI under **Database > Export/Import**, providing a visual way to manage full backups or partial content transfers.

---

## 3. Logs & Auditing

- **Activity Logs**: Track CMS actions (who changed what and when). Managed via `ActivityLogService`.
- **Webhook Deliveries**: Audit outbound relay history and retry status in the **Webhooks** settings.
