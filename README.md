# Adonis EOS — Custom CMS (AdonisJS + Inertia + React)

A high-performance, SEO-first CMS built with AdonisJS 6, Inertia, React, Tailwind, and ShadCN. Content is composed of modules (hero, callouts, etc.) that can be reordered, reused globally, or grouped into templates for rapid post creation.

Note: Role-based access control (RBAC) is out of scope for the initial milestones. Admin sections are protected by authentication only; roles/permissions will be added later.

## Tech Stack
- Backend: AdonisJS 6 (Lucid, Validator, Bouncer)
- Frontend: Inertia + React
- Styling: Tailwind (dark/light via class strategy) + ShadCN
- Forms/Validation: ShadCN + Zod
- DnD: dnd-kit
- Rich Text: Lexical (JSON stored, SSR-rendered to HTML)
- Database: PostgreSQL
- Caching: CDN + per-module render cache

## Milestones

### Milestone 1 — Foundation & Setup
- Initialize AdonisJS 6 + Inertia + React project
- Configure Vite with separate admin/site entries
- Add Tailwind + ShadCN (class strategy for dark/light)
- Add basic auth (login/logout, sessions). No RBAC yet.

How to test:
1. Install deps:
   - `npm install`
2. Configure environment:
   - Copy `.env.example` to `.env` if needed
   - Set `DB_*` variables for PostgreSQL connection
   - Run `node ace generate:key` to generate APP_KEY
3. Set up database:
   - Run `node ace migration:run` to create users table
   - Run `node ace db:seed` to create admin user
4. Start dev server:
   - `npm run dev`
5. Test site entry:
   - Visit `http://localhost:3333/`
   - Confirm Tailwind styles are applied
6. Test admin auth:
   - Click "Admin login" or visit `http://localhost:3333/admin/login`
   - Login with: `i@modernaut.com` / `supersecret`
   - Confirm redirect to `/admin` dashboard
   - Test logout

### Milestone 2 — Database Schema (✅ Complete)
- Create migrations for:
  - `posts` (with i18n: locale, translation_of_id)
  - `module_instances`, `post_modules`
  - `templates`, `template_modules`
  - `url_patterns`, `url_redirects` (locale-aware)
  - `module_scopes`
  - `custom_fields` (with translatable flag), `post_type_custom_fields`, `post_custom_field_values`
- Performance optimizations:
  - GIN indexes on all JSONB columns for efficient queries
  - Composite indexes on (post_id, order_index) for fast page rendering
  - Composite indexes on (locale, status, type) for filtered content lists
  - Index on (from_path, locale) for redirect middleware performance

How to test:
1. Run: `node ace migration:run`
2. Verify tables exist: `posts`, `templates`, `url_patterns`, `url_redirects`, etc.
3. Run smoke test: `node ace db:seed --files database/seeders/smoke_test_seeder.ts`
4. Verify i18n: Check that posts can have translations, URL patterns are locale-specific.

### Milestone 3 — Internationalization (i18n)
- Locale detection middleware (URL prefix, domain, headers, session)
- Translation UI in admin editor
- hreflang tag generation
- Locale-aware URL routing and redirects
- Fallback logic for missing translations
- API endpoints:
  - `GET /api/locales` – list configured locales
  - `GET /api/posts/:id/translations` – list translations
  - `POST /api/posts/:id/translations` – create translation

How to test:
1. Configure multiple locales via environment (e.g., `LOCALES=en,es,fr`)
2. Create a post and add translations
3. Visit locale-specific URLs (e.g., `/blog/post` vs `/es/blog/publicacion`)
4. Verify hreflang tags in page source
5. Test fallback: remove translation and verify default locale is used

### Milestone 4 — Module System (Backend & SSR)
- Implement ModuleModel base + registry
- Implement `ModuleHero` and `ModuleProse` with SSR (Lexical)
- Implement render pipeline (merge props/overrides, JSON-LD, cache hooks, locale context)
- Enforce module scopes by post type
- API endpoints:
  - `GET /api/modules/registry`
  - `POST /api/posts`, `PUT /api/posts/:id`, `GET /api/posts/:slug`
  - `POST /api/posts/:id/modules`, `PUT /api/post-modules/:id`
  - `POST /api/modules/global`, `GET /api/modules/global/:slug`

How to test:
1. Create a post via `POST /api/posts` (optionally with template).
2. Add a `ModuleHero` via `POST /api/posts/:id/modules`.
3. Fetch `GET /api/posts/:slug` and verify ordered modules and SSR HTML.
4. Confirm `GET /api/modules/registry` returns schemas.
5. Test module scopes: try adding restricted module to wrong post type.

### Milestone 5 — Admin Editor MVP
- Inertia Admin:
  - DnD sortable module list (local/global/static)
  - Module picker (local/global/static)
  - Locks UI (module-level, template-level)
  - Overrides panel
  - Custom fields panel
  - Translation editor (side-by-side with fallback preview)
  - Locale switcher
  - Dark/Light toggle (persisted per user)

How to test:
1. Login and visit admin editor for a post.
2. Add/reorder modules (local/global/static) and verify persistence.
3. Apply locks; ensure locked behavior is enforced.
4. Edit overrides; confirm merged output in render.
5. Switch locales and edit translations; verify fallback preview.
6. Toggle dark/light and confirm persistence.

### Milestone 6 — SEO & Routing
- Canonical/robots management; OG/Twitter metadata (locale-specific)
- JSON-LD per module + post-level SEO merge
- hreflang tags for all translations
- URL patterns:
  - `GET /api/url-patterns`, `PUT /api/url-patterns/:id`
  - Apply URL generation and automatic 301 on slug change
- Redirects middleware and APIs (locale-aware)

How to test:
1. Configure URL patterns for different locales; create posts and verify URLs.
2. Change slug; confirm 301 is issued and destination resolves.
3. Create redirect rules; verify middleware short-circuits with expected status.
4. View page source; verify meta tags, JSON-LD, and hreflang tags.
5. Test locale-specific redirects.

### Milestone 7 — Caching & Performance
- Per-module render cache (HTML + ETag, locale-aware cache keys)
- CDN-friendly caching by path
- Image performance: AVIF/WebP, lazy load, priority hints
- Query optimization using GIN and composite indexes

How to test:
1. Warm a page; reload and verify cache headers/ETag behavior.
2. Invalidate a module and verify re-render.
3. Confirm image formats and lazy-loading in DOM.
4. Run query performance tests with EXPLAIN ANALYZE.

### Milestone 8 — Admin Tools
- Admin: URL pattern manager UI
- Admin: Redirects manager UI
- Admin: Template builder
- Admin: Locale configuration

How to test:
1. Change URL patterns via UI; verify affected routes.
2. Create/delete redirects via UI; verify middleware behavior.
3. Build templates with locked modules; verify enforcement.
4. Add/remove locales; verify system behavior.

### Milestone 9 — RBAC (Future Scope)
- Introduce roles (Admin, Editor, Translator, etc.) and permissions
- Enforce role-based access with Bouncer
- Translation workflow (draft → review → publish)

How to test:
1. Create users with different roles.
2. Verify editor access, editing capabilities, and UI visibility vary by role.
3. Test translation workflow: translator submits, editor approves.

## Local Development
- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Run migrations: `node ace migration:run`
- Run seeds (optional): `node ace db:seed`

## Security
- Do not commit secrets. Use environment variables.
- Apply least privilege to DB users.
- Use HTTPS in all environments.

## Documentation
Keep documentation consolidated in this README. Add details here rather than creating extra .md files whenever possible.


