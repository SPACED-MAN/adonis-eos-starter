# Launch Guide (Production)

Prepare and load initial production content using the same JSON import pipeline as the admin UI.

## Before you launch
- **Export curated content**: Create `database/seeders/production-export.json` from your staging or prep environment (admin UI → Database Export, include IDs).
- **Review safety**: The production import seeder will abort if key tables already have rows to avoid clobbering live data. Run on a fresh/empty database.
- **Run migrations**: `node ace migration:run --force` on the target environment.

## Seeding production with the curated export
We added `database/seeders/production_import_seeder.ts`:
- Environment: `production` only.
- Guard: aborts if `users`, `posts`, `menus`, `module_instances`, or `forms` are non-empty.
- Import: uses `DatabaseImportService.importFromBuffer` with `strategy: 'replace'`, `preserveIds: true`, and FK checks disabled during import.
- Expects current schema names (`module_groups`, `module_group_modules`, `module_group_id` on posts). No legacy `template_*` compatibility.

### Steps
1) Copy your curated export to `database/seed_data/production-export.json` on the server or build artifact.
2) Ensure the DB is empty (fresh instance) and migrations are applied.
3) Run the seeder:
   ```bash
   NODE_ENV=production node ace db:seed --files database/seeders/production_import_seeder
   ```
4) Verify admin access and content in the UI.

## Updating launch content close to go-live
- Re-export from staging, replace `production-export.json`, and re-run the seeder on a fresh database.
- If the database is not empty, the seeder will stop; drop/recreate the DB (or truncate) before re-running.

## Development parity
- Development uses `database/seeders/development_import_seeder.ts` to load `development-export.json` automatically when `NODE_ENV=development` or `APP_ENV=development`.

## Safety and best practices
- Keep exports out of VCS if they contain sensitive data; otherwise ensure no secrets are embedded.
- Preserve IDs when exporting so references remain intact (menus, modules, forms, posts).
- Run imports from a CI/CD step only on fresh databases; do not use this seeder for incremental updates to live data.

