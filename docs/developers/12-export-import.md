# Export/Import

Adonis EOS has a **first-class database export/import pipeline** used for:

- local development seeding
- staging → production promotion (curated export)
- backup/restore of CMS content

The export format is **JSON** and includes metadata + per-table rows.

## Key files

- Export service: `app/services/database_export_service.ts`
- Import service: `app/services/database_import_service.ts`
- Admin UI controller: `app/controllers/database_admin_controller.ts`
- Seed exports:
  - `database/seed_data/development-export.json`
  - `database/seed_data/production-export.json`
- Seeders:
  - `database/seeders/development_import_seeder.ts`
  - `database/seeders/production_import_seeder.ts`
  - `database/seeders/index_seeder.ts`

## Export format

Exports look like:

```json
{
  "metadata": {
    "version": "2.0.0",
    "exportedAt": "...",
    "databaseType": "pg",
    "tableCount": 22,
    "contentTypes": ["posts", "modules"],
    "preserveIds": true
  },
  "tables": {
    "posts": [ ... ],
    "module_instances": [ ... ]
  }
}
```

Notes:

- **`preserveIds=true`** is recommended for portable content so relationships remain intact.
- `contentTypes` can restrict which groups of tables are exported.
- If `contentTypes` is omitted, the exporter will include **all tables** (excluding system schema tables). This is recommended for full backups.

## Content types (export filters)

Content types are defined in `app/services/database_export_service.ts`:

- `media` → `media_assets`
- `posts` → `posts`, `post_revisions`, `post_modules`, `custom_fields`, `post_type_custom_fields`, `post_custom_field_values`, `preview_tokens`
- `modules` → `module_instances`, `module_scopes`
- `forms` → `forms`, `form_submissions`
- `menus` → `menus`, `menu_items`
- `categories` → `taxonomies`, `taxonomy_terms`, `post_taxonomy_terms`
- `module_groups` → `module_groups`, `module_group_modules`, `url_patterns`, `url_redirects`, `post_type_settings`, `webhooks`, `webhook_deliveries`

The exporter always includes “essential” tables like `users`, `site_settings`, `locales`.
It also includes `post_type_settings` as essential configuration (even when filtering by content types).

## Import strategies

Import strategies live in `app/services/database_import_service.ts`:

- **`replace`**: destructive replace (clear tables then insert)
- **`merge`**: insert new rows; skip conflicts
- **`skip`**: only import a table if it is empty
- **`overwrite`**: update existing rows by ID and insert new ones

Important:

- If `preserveIds=false`, `overwrite` is downgraded to `merge` semantics (IDs won’t match).

## Admin API endpoints

From `app/controllers/database_admin_controller.ts`:

- `GET /api/database/export/stats`
- `GET /api/database/export` (downloads JSON)
- `POST /api/database/import` (multipart file upload)

## Full backup export (recommended when auditing coverage)

To capture everything (including newer tables that might not map cleanly to a single “content type”), use either:

- Admin UI: **Export all tables** toggle (Database → Export)
- API: call `GET /api/database/export?preserveIds=true` **without** `contentTypes`

## Seeding behavior (local/dev)

`database/seeders/index_seeder.ts` drives environment behavior:

- **Development**: imports `database/seed_data/development-export.json`, then re-seeds docs from markdown (so new docs files are always reflected).
- **Production**: imports `database/seed_data/production-export.json` with safety guards (fresh DB only).

## Recommended workflow

- **Staging → production**:
  1. Export from staging via Admin → Database Export with `preserveIds=true`.
  2. Commit/store the curated export as `database/seed_data/production-export.json` in your deploy artifact.
  3. Run `node ace db:seed --files database/seeders/production_import_seeder` on a fresh production DB.

- **Updating dev seed**:
  - regenerate `development-export.json` from a known-good dataset so new features are covered.
