# Adonis EOS — Custom CMS (AdonisJS + Inertia + React)

A high-performance, SEO-first CMS built with AdonisJS 6, Inertia, React, Tailwind, and ShadCN. Content is composed of modules (hero, callouts, etc.) that can be reordered, reused globally, or grouped into templates for rapid post creation.

Note: Basic Role-based access control (RBAC) is implemented in Milestone 9 (admin/editor/translator) with server enforcement and UI gating. Further fine-grained rules can be extended.

## Tech Stack
- **Server:** AdonisJS 6 (Lucid ORM, Validator, Bouncer, SSR)
- **Client:** Inertia + React
  - Admin Panel: `inertia/admin/*` (content management)
  - Public Site: `inertia/site/*` (visitor-facing)
- Styling: Tailwind (dark/light via class strategy) + ShadCN
- Forms/Validation: ShadCN + Zod
- DnD: dnd-kit
- Rich Text: Lexical (JSON stored, SSR-rendered to HTML)
- Database: PostgreSQL
- Caching: Redis (SSR page caching)

## Project Structure

### Inertia Pages
```
inertia/
├── app/                    # SSR entrypoint
│   └── ssr.tsx            # SSR + Redis caching
├── admin/                  # Admin Panel (content management)
│   ├── pages/
│   │   ├── errors/        # Admin-styled error pages
│   │   │   ├── not_found.tsx
│   │   │   └── server_error.tsx
│   │   ├── dashboard.tsx
│   │   └── login.tsx
│   └── app.tsx            # Admin client entrypoint
├── site/                   # Public Site (visitor-facing)
│   ├── pages/
│   │   ├── errors/        # Public-styled error pages
│   │   │   ├── not_found.tsx
│   │   │   └── server_error.tsx
│   │   └── home.tsx
│   └── app.tsx            # Site client entrypoint
├── modules/                # Shared content modules
│   ├── hero-static.tsx    # Pure SSR (static)
│   ├── prose-static.tsx   # Pure SSR (static)
│   ├── gallery.tsx        # React SSR + hydration (interactive)
│   ├── accordion.tsx      # React SSR + hydration (interactive)
│   ├── types.ts           # Shared UI types
│   └── index.ts           # Module registry
├── components/             # Shared React components
│   └── ModuleRenderer.tsx
└── css/
    └── app.css            # Global styles
```

**Error Pages:** Separate versions for admin and public site ensure appropriate styling and CTAs based on context. The exception handler automatically routes to the correct version based on URL prefix (`/admin/*` vs everything else).

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
   - Login with: `admin@example.com` / `supersecret`
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

### Milestone 3 — Internationalization (i18n) (✅ Complete)
- Locale configuration and detection
  - Environment-based configuration (DEFAULT_LOCALE, SUPPORTED_LOCALES)
  - LocaleService for managing locales
  - Locale detection middleware (URL prefix, domain, headers, session)
  - Locale stored in HTTP context for request-scoped access
- Post model with translation support
  - Translation relationships (originalPost, translations)
  - Query scopes (byLocale, originals, published)
  - Helper methods (getAllTranslations, getTranslation, hasTranslation)
- API endpoints:
  - `GET /api/locales` – list configured locales (public)
  - `GET /api/locales/:locale` – get locale info (public)
  - `GET /api/posts/:id/translations` – list translations (auth required)
  - `POST /api/posts/:id/translations` – create translation (auth required)
  - `GET /api/posts/:id/translations/:locale` – get specific translation (auth required)
  - `DELETE /api/posts/:id/translations/:locale` – delete translation (auth required)
- Helper utilities:
  - hreflang tag generation
  - Locale-aware URL generation
  - Locale switcher builder
  - Content fallback logic
  - Locale extraction and validation

How to test:
1. Run automated tests:
   - `node ace test` – Run all tests (✅ All 26 tests passing)
     - 16 i18n tests (Locale service, Post model, Helper functions)
     - 10 Actions tests (CreateTranslation, DeleteTranslation)
   - Test files:
     - `tests/unit/i18n.spec.ts` – i18n functionality
     - `tests/unit/actions/translation_actions.spec.ts` – Translation actions
   - **Note:** Functional API tests will be implemented in Milestone 5 with the admin UI
2. Test public API endpoints manually:
   - `curl http://localhost:3333/api/locales` – List locales
   - `curl http://localhost:3333/api/locales/en` – Get locale info
   - `curl http://localhost:3333/api/locales/fr` – Test unsupported locale
3. Verify locale configuration:
   - Check `.env` for DEFAULT_LOCALE and SUPPORTED_LOCALES
   - Default: en,es (can be extended to fr,de,etc.)
4. Test with smoke test data:
   - `node ace db:seed --files database/seeders/smoke_test_seeder.ts`
   - Smoke test creates posts in both 'en' and 'es' locales
5. Watch mode for TDD:
   - `node ace test --watch` – Re-run tests on file changes

### Milestone 4 — Module System & Public Post Viewing (✅ Complete)
**Implemented:**
- ✅ Base Module system with `BaseModule` class and type definitions
- ✅ Module Registry service for managing available modules
- ✅ `HeroModule` with SSR rendering (titles, subtitles, CTAs, images)
- ✅ `ProseModule` with Lexical JSON SSR (paragraphs, headings, lists, formatting)
- ✅ Module Renderer service (props merging, locale context, JSON-LD generation)
- ✅ Module Scope service (enforce which modules work with which post types)
- ✅ Actions pattern for post/module operations:
  - `CreatePost`, `UpdatePost`
  - `AddModuleToPost`, `UpdatePostModule`
- ✅ API endpoints (authenticated):
  - `GET /api/modules/registry` – List all registered modules
  - `GET /api/modules/:type/schema` – Get specific module schema
  - `POST /api/posts` – Create post (with optional template seeding)
  - `PUT /api/posts/:id` – Update post
  - `POST /api/posts/:id/modules` – Add module to post
  - `PUT /api/post-modules/:id` – Update module (reorder, overrides, lock)
- ✅ Public post viewing:
  - `GET /posts/:slug` – View post with SSR modules (public, SEO-optimized)
  - Server-side rendering with Redis caching
  - JSON-LD structured data for rich search results
  - Locale-aware (pass `?locale=es` for translations)
- ✅ Comprehensive unit tests (53/53 passing - 100%):
  - Module registry tests (9/9 ✅)
  - Hero module tests (6/6 ✅)
  - Prose module tests (6/6 ✅)
  - Post action tests (6/6 ✅)
  - Translation action tests (11/11 ✅)
  - i18n tests (16/16 ✅)

**Modules Bootstrap:**
- Modules are automatically registered on app startup via `start/modules.ts`
- Current modules: Hero, Prose
- Extensible: add new modules by creating class and registering

**Creating New Modules:**

Generate a new module:
```bash
# Interactive module (default - uses React)
node ace make:module Gallery

# Static module (pure SSR, max performance)
node ace make:module Testimonial --mode=static
```

This creates **two files**:
- **Backend:** `app/modules/gallery.ts` (configuration, schema, validation)
- **Frontend:** `inertia/modules/gallery.tsx` or `gallery-static.tsx` (React component)

Both files include:
- Complete scaffolding with helpful TODO comments
- Type-safe props interfaces
- Module configuration
- Schema definition for validation
- Ready-to-implement templates

Then:
1. Implement the TODOs in both files
2. Register in `start/modules.ts`:
   ```typescript
   import GalleryModule from '#modules/gallery'
   ModuleRegistry.register(new GalleryModule())
   ```
3. Create unit tests in `tests/unit/modules/`

**Choosing Mode:**
- `--mode=static`: Simple content (text, images, CTAs) → Pure SSR, max performance
- `--mode=react` (default): Interactive features (tabs, carousels, forms) → React SSR + hydration

See `app/modules/hero.ts` / `inertia/modules/hero-static.tsx` for static examples.
See `app/modules/gallery.ts` / `inertia/modules/gallery.tsx` for React examples.

How to test:
1. Run automated tests: `node ace test unit`
2. Check module registry: `curl http://localhost:3333/api/modules/registry`
3. Get module schema: `curl http://localhost:3333/api/modules/hero/schema`
4. Create test data:
   ```bash
   node ace db:seed --files database/seeders/smoke_test_seeder.ts
   ```
5. View a post in the browser:
   - Visit `http://localhost:3333/posts/test-post` (English version)
   - Visit `http://localhost:3333/posts/publicacion-de-prueba?locale=es` (Spanish version)
   - View page source to see JSON-LD structured data
6. Test via API (requires auth):
   ```bash
   # Create a new post
   curl -X POST http://localhost:3333/api/posts \
     -H "Content-Type: application/json" \
     -d '{"type":"blog","locale":"en","slug":"my-post","title":"My Post"}'
   
   # Add a Hero module to the post
   curl -X POST http://localhost:3333/api/posts/{POST_ID}/modules \
     -H "Content-Type: application/json" \
     -d '{"moduleType":"hero","scope":"local","props":{"title":"Welcome"}}'
   ```
7. Verify caching:
   - First page load: ~10-20ms (SSR + module rendering)
   - Subsequent loads: ~0.5ms (Redis cache hit)
   - Clear cache: `redis-cli FLUSHDB`

### Milestone 5 — Admin Editor MVP (✅ Complete)
- Admin editor:
  - Module picker (local/global/static)
  - DnD sortable module list (pointer handle)
  - Module editor panel (schema-free MVP, overrides saved; local modules persist to props)
  - Custom fields panel (post-level metadata)
  - Translation editor (side-by-side original fallback for post fields)
  - Locale switcher (create missing translation; navigate to existing)
  - Dark/Light theme (class strategy, persisted; accessible contrast across UI)
  - Status toasts using Sonner (theme-aware)
- Public site:
  - Consistent dark/light styles, corrected neutral scale in dark mode
  - Hero/Prose modules updated to neutral tokens for reliable dark variants

How to test:
1. Login and open `/admin/posts/:id/edit`.
2. Use “Add Module” to insert modules; re-order via drag handle; refresh to confirm order persists.
3. Click “Edit” on a module, change fields, Save; verify changes render on public page.
4. Switch locale via the selector; if missing, click “Create Translation”, then edit the new locale.
5. Toggle dark/light in footer; confirm backgrounds, borders, and text adjust correctly in admin and site.
6. View a public post and check SEO alternates/canonical are present (see Milestone 6).

### Milestone 6 — SEO & Routing (✅ Complete)
**Implemented (SEO):**
- ✅ Absolute canonical URL per post/locale
- ✅ hreflang alternates for all translations
- ✅ Robots meta (index,follow for published; noindex,nofollow otherwise)
- ✅ OpenGraph tags (title, description, url, type=article)
- ✅ Twitter card tags (summary_large_image; title, description)
- ✅ JSON-LD (BlogPosting) merged with post-level overrides

How to test (SEO):
1. Open any public post page (`/posts/:slug?locale=xx`) and inspect `<head>`:
   - `<link rel="canonical" href="https://your-host/posts/:slug?locale=xx" />`
   - `<link rel="alternate" hreflang="en|es|…">` for sibling locales
   - `<meta name="robots" content="index,follow">` for published, or `noindex,nofollow` otherwise
   - `<meta property="og:title" ...>`, `<meta property="og:description" ...>`, `<meta property="og:url" ...>`, `<meta property="og:type" content="article">`
   - `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:title" ...>`, `<meta name="twitter:description" ...>`
   - `<script type="application/ld+json">` contains BlogPosting JSON-LD (with overrides merged)
2. Toggle post status to `draft` and reload: robots should switch to `noindex,nofollow`.
3. Change post meta title/description and verify OG/Twitter and JSON-LD reflect changes.

**Implemented (Routing):**
- ✅ Redirects middleware (locale-aware) with `url_redirects` table
- ✅ Auto-create 301 redirect on post slug change (pattern-based)
- ✅ URL Patterns
  - Table: `url_patterns` with `locale`, `pattern` (e.g., `/{locale}/posts/{slug}` or `/posts/{slug}`)
  - APIs (auth required):
    - `GET /api/url-patterns` → list patterns
    - `PUT /api/url-patterns/:locale { postType, pattern }` → upsert default pattern for postType+locale
  - Used for canonical and hreflang URL generation
  - Used when generating 301 redirects after slug change

Notes:
- Canonical/alternate URLs are built from request protocol/host; ensure your dev/prod host is correct when testing. 
- Default pattern is `/{locale}/posts/{slug}` when none is set for a locale.

How to test (Routing):
1. Auto 301 on slug change:
   - Edit a post in Admin, change the slug, Save.
   - Visit the old URL (pattern-based path) — should 301 to the new URL.
   - Check DB: `select * from url_redirects where from_path like '%OLD-SLUG%';`
2. Manual redirect:
   - Insert into `url_redirects (from_path, to_path, locale, status_code)` and request the `from_path`.
   - Confirm the middleware issues the configured redirect (default 301).
3. Locale behavior:
   - Create a redirect with a specific `locale`, and one with `locale = null`.
   - Requests with `?locale=xx` should prefer the locale-specific record, else fallback to the null-locale record.
4. URL Patterns:
   - `PUT /api/url-patterns/en { "postType":"blog", "pattern": "/blog/{slug}" }`
   - Reload a post (en): canonical and alternates use `/blog/{slug}` for `en`.
   - Change a slug; verify the created redirect uses the updated pattern in `from_path` and `to_path`.

### Milestone 7 — Caching & Performance (✅ Complete)
- ✅ Redis SSR page caching (1-hour TTL, cache key based on component + props)
- ✅ CDN-friendly caching: Cache-Control headers for public pages (public, s-maxage=3600, SWR)
- ✅ Image performance: eager+fetchpriority for hero; lazy+decoding=async for gallery
- ✅ Query optimization: GIN indexes on posts JSONB (`robots_json`, `jsonld_overrides`)

How to test:
1. Redis caching: Refresh a page twice, second load should be faster (~0.5ms vs ~10-20ms)
2. Check Redis keys: `redis-cli KEYS "ssr:*"` to see cached pages
3. Invalidate cache: `redis-cli FLUSHDB` to clear all cached pages
4. Confirm image loading behavior in DOM:
   - Hero image has `fetchpriority="high"` and `decoding="async"`
   - Gallery images have `loading="lazy"` and `decoding="async"`
5. Verify response headers on public pages (non-admin):
   - `Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=604800`
   - `Vary: Accept-Encoding`
6. Run query performance checks with EXPLAIN ANALYZE.

'### Milestone 8 — Admin Tools (✅ Complete)
- ✅ Admin: URL pattern manager UI
- ✅ Admin: Redirects manager UI
- ✅ Admin: Template builder
- ✅ Admin: Locale configuration

How to test:
1. URL Patterns:
   - Visit `http://localhost:3333/admin/settings/url-patterns`
   - Edit default pattern per post type and locale. Must include `{slug}`.
   - Save and reload a public post; canonical/alternates and redirect generation will use updated patterns.
2. Redirects:
   - Visit `http://localhost:3333/admin/settings/redirects`
   - Create a redirect (optionally set locale). Test the `from_path` in browser; confirm 301 to `to_path`.
   - Delete a redirect and verify it no longer applies.
3. Build templates with locked modules; verify enforcement.
4. Add/remove locales; verify system behavior.

### Milestone 9 — RBAC (✅ Complete)
- Roles: admin, editor, translator
- Server enforcement:
  - Auth uses `web` guard consistently (login/logout/middleware).
  - Admin-only middleware protects settings and destructive APIs (redirects, templates, delete single post).
  - PostsController enforces action-level permissions:
    - Create post: admin, editor
    - Update status: translator can set draft only; editor/admin can publish/archive
    - Bulk actions (auth required):
      - translator: draft
      - editor: publish, archive, draft
      - admin: publish, archive, draft, delete (archived only)
- UI gating:
  - Admin header shows admin-only nav when `isAdmin` is true.
  - Dashboard: 
    - “Create New” visible to admin/editor
    - Bulk actions filtered by role (delete visible only to admin)
- Inertia shared props:
  - `currentUser`, `auth.user`, and `isAdmin` are shared on every request.
- Authorization service:
  - `app/services/authorization_service.ts` centralizes role checks used by controllers/UI.

How to test:
1. Seed users: `node ace db:seed --files database/seeders/user_seeder.ts`
   - admin@example.com / supersecret
   - editor@example.com / supersecret
   - translator@example.com / supersecret
2. Login as each role and visit `/admin`:
   - Admin: sees admin nav; can create posts; can publish/archive/draft; can delete archived via bulk
   - Editor: no admin nav; can create posts; can publish/archive/draft; cannot delete via bulk
   - Translator: no admin nav; cannot create posts; bulk shows only “Move to Draft”
3. Try restricted pages (as non-admin) like `/admin/settings/templates`:
   - Should redirect to `/admin/forbidden`.
4. Try bulk operations as editor/translator and verify server responses enforce permissions.

### Milestone 10 — Admin UI Improvements & Dashboard (✅ Complete)
- Admin dashboard:
  - Updated column now shows date and time.
  - Translation progress indicators show per-locale badges (filled = exists, muted = missing).
  - Sorting kept; columns aligned so Updated sits next to Status.
- Post editor:
  - Status moved into the right sidebar “Actions” panel (renamed from “Quick Actions”).
  - Primary button unified: “Save Changes” (or “Publish Changes” when status is “published”), disabled until form changes are made. Saving persists both status and fields.
  - “Update Status” button removed; status is saved with the primary button.
  - “Modules” section moved above “SEO Settings”.
  - Created/Updated show date and time.
  - Back to Dashboard consistently available via a top-right breadcrumb bar.
- Templates:
  - New Templates list at `/admin/templates` with search/filter and “Create New”.
  - Dedicated Template editor with drag-and-drop modules, matching the post Modules UI.

How to test:
1. Dashboard:
   - Visit `/admin`: verify Updated shows date+time and locale badges reflect translation presence.
   - Sort columns and check the Updated column position next to Status.
2. Post editor:
   - Open `/admin/posts/:id/edit`: confirm Status is in the “Actions” panel.
   - Make a small change: the primary button becomes prominent and enabled; click to save.
   - Set Status to “published” and verify button label reads “Publish Changes”.
3. Templates:
   - Visit `/admin/templates`: filter by post type, create a new template, and you are redirected to its editor.
   - In the template editor, add modules and reorder via drag handle; refresh to confirm persistence.

### Milestone 11 — Review Workflow & Dual-Version System (✅ Complete)
- Dual version support:
  - Adds `review_draft` (JSONB) to `posts` to store a review version of the post without affecting the live data.
  - Editor toggle: “Approved” vs “Review” views. Review view loads/saves to `review_draft`.
  - “Save for Review” action stores changes in `review_draft` only.
  - Live status remains Published even if a Review draft exists.
- UI:
  - Actions panel includes a segmented control to switch views.
  - Primary button adapts: “Save for Review” (Review view), “Publish Changes” when status=Published, else “Save Changes”.

How to test:
1. Run migration: `node ace migration:run` (adds `review_draft`).
2. Open `/admin/posts/:id/edit`, switch to Review view, change fields, click “Save for Review”.
3. Refresh: Review view shows saved values; switch to Published view to confirm live is unchanged.
4. Switch to Published view and click “Publish Changes” to update live fields.

### Milestone 12 — Revision History (ENV-Based Retention) (✅ Complete)
- ✅ Database: `post_revisions` table storing `mode` (approved/review), `snapshot` (JSONB), timestamps, and `user_id`
- ✅ Env: `CMS_REVISIONS_LIMIT` (number) controls how many revisions to retain per post (default 20)
- ✅ Auto-prune: After each new revision, older ones beyond the limit are pruned
- ✅ API:
  - `GET /api/posts/:id/revisions?limit=10` – list recent revisions with author and mode
  - `POST /api/posts/:id/revisions/:revId/revert` – revert to a revision
    - Review-mode revisions restore to `review_draft`
    - Approved-mode revisions update live fields (RBAC enforced)
- ✅ UI (Editor sidebar):
  - “Revisions” panel listing recent revisions with timestamps, author, and mode
  - “Revert” button per revision

How to test:
1. Set retention (optional) in `.env`: `CMS_REVISIONS_LIMIT=20`
2. Edit a post and click “Save Changes” (Approved) or switch to Review view and “Save for Review” — a revision is recorded automatically.
3. Open `/admin/posts/:id/edit`: in the sidebar, expand “Revisions”.
4. Click “Revert” on a revision:
   - If “Approved”: the live post fields are updated (slug/title/status/meta/etc.). RBAC applies (editor/admin for publish/archive).
   - If “Review”: the `review_draft` is replaced with that snapshot.
5. Refresh and verify the fields changed accordingly. Older revisions should be pruned beyond `CMS_REVISIONS_LIMIT`.

### Milestone 13 — Import/Export (Canonical Post JSON Format)
✅ Complete

- ✅ Canonical JSON format (versioned)
  - Top-level `post` (type, locale, slug, title, status, SEO fields)
  - `modules`: array with `{ type, scope(local|global), orderIndex, locked, props, overrides, globalSlug }`
  - `translations`: list of family post IDs and locales (for reference)
- ✅ Export API: `GET /api/posts/:id/export?download=1`
  - Downloads `post-<id>.json`
- ✅ Import APIs:
  - `POST /api/posts/import { data }` → creates a new post (admin/editor)
  - `POST /api/posts/:id/import { data, mode: 'replace'|'review' }`
    - `replace`: overwrites live post fields and modules (RBAC checks for status changes)
    - `review`: stores top-level fields into `review_draft` without altering live data
- ✅ Editor UI:
  - “Export JSON” button in the Actions sidebar
  - “Import JSON (Replace or Review)” file input
  - “Import JSON as New Post” file input (creates a new post and redirects to editor)
- ✅ Internal services:
  - `PostSerializerService` (serialize/import/create/replace)
  - Reuses existing actions (`CreatePost`, `UpdatePost`, `AddModuleToPost`)

How to use:
1. Open `/admin/posts/:id/edit` → Actions sidebar → Import / Export.
2. Export: click “Export JSON”.
3. Import (replace live or into review draft): choose JSON → select mode.
4. Import as new post: choose JSON → auto-redirects to new post editor.

### Milestone 14 — Module Field Types Framework & Repeater Fields (✅ Complete)
- ✅ Field types framework in the module editor (schema-driven via `propsSchema`)
- ✅ Core field types supported:
  - text, textarea, number, select, multiselect, boolean, date, url, media
  - object (nested fields) and repeater (array of objects or primitives)
  - richtext (Lexical JSON), slider (numeric with step/min/max)
- ✅ Editor renders appropriate ShadCN components:
  - `Input`, `Textarea`, `Select`, `Popover+Calendar` for date, `Checkbox`, slider, etc.
  - Nested object fields render as fieldsets; repeaters support add/remove/reorder
- ✅ Schema-free fallback for unknown fields (safe text/JSON editing)
- ✅ Post-reference field type included in sample `KitchenSink` module to select posts by type

How to test:
1. Open any post editor `/admin/posts/:id/edit`.
2. Add the “Kitchen Sink” module.
3. Expand “Edit” to see all field types rendered; change values and click Done.
4. Save changes and verify they render on the public page (for static fields) or in the module preview.
5. For repeater fields:
   - Add items, move up/down, and remove to confirm indexing and persistence.
6. For post-reference:
   - Select one or more posts and verify saved IDs; render in a module/teaser if desired.

### Milestone 15 — Agent Runner (Webhook-Based Suggestions) (✅ Complete)
**Implemented:**
- ✅ Env-based agents configuration via `CMS_AGENTS` (JSON array)
  - Example:
    ```bash
    CMS_AGENTS='[
      {"id":"seo","name":"SEO Optimizer","url":"https://example.com/webhook","secret":"YOUR_TOKEN"},
      {"id":"style","name":"Style Enhancer","url":"https://example.com/style"}
    ]'
    ```
- ✅ API (admin-only; auth required)
  - `GET /api/agents` → list configured agents (id, name)
  - `POST /api/posts/:id/agents/:agentId/run { context? }`
    - Sends canonical post JSON to the agent
    - Expects JSON response with optional `post` object containing suggested field updates
    - Applies suggestions to `review_draft` only and records a Review revision
- ✅ UI (Post Editor → Actions)
  - Agent dropdown (hidden “Run Agent” button until an agent is selected)
  - “Run Agent” button styled as the primary action; appears below the dropdown
  - On success, switches to Review view and toasts confirmation
- ✅ Security / RBAC
  - Admin/Editor may run agents; Translators cannot
  - CSRF header sent for all mutating requests

Agent response contract (example):
```json
{
  "post": {
    "title": "Improved SEO Title",
    "metaDescription": "Sharper description written by the SEO agent."
  }
}
```
Only top-level post fields in `post` are merged into `review_draft`. Live content is not changed.

How to test:
1. Configure agents in `.env` as shown above, then restart the dev server.
2. Open `/admin/posts/:id/edit` → Actions panel.
3. Select an agent, click “Run Agent”.
4. On success, a toast confirms suggestions were saved; the editor switches to Review view.
5. Verify Review view shows suggested fields. Approve when ready to promote to live.
6. RBAC: Login as editor/admin to run; as translator, confirm you cannot run agents.
7. Error handling: Make the webhook return a non-2xx status and verify you see an error toast.

### Milestone 16 — Media Library & Attachment Tracking (✅ Complete)
- ✅ Media Assets DB and API
  - Table: `media_assets` with url, original_filename, mime_type, size, alt_text, caption, description, metadata, timestamps, and `categories text[]` (free tags)
  - APIs (admin; auth required):
    - `GET /api/media` – list with sort by `created_at | original_filename | size`, plus `?category=<tag>` filter
    - `GET /api/media/categories` – distinct category tags across all media
    - `POST /api/media` – upload (supports `naming=original|uuid`, altText defaulting)
    - `PATCH /api/media/:id` – update `altText`, `caption`, `description`, and `categories`
    - `DELETE /api/media/:id` – delete original and all generated variants
    - `POST /api/media/:id/variants` – generate variants; accepts `cropRect` or `focalPoint`
    - `PATCH /api/media/:id/rename` – rename original and variants safely
    - `GET /api/media/:id/where-used` – show references in modules/overrides
    - `POST /api/media/check-duplicate` – find existing by original filename
    - `POST /api/media/:id/override` – replace the file in-place and rebuild variants
  - Public API:
    - `GET /public/media/:id` – public media info by ID (url, variants, altText) for frontend rendering
- ✅ Admin UI (`/admin/media`)
  - Grid with previews (uses configured thumbnail variant), alt-first label (fallback to original filename), size, added date
  - Drag-and-drop upload zone + polished Upload button
  - “Use original filename” toggle (persisted in localStorage)
  - Duplicate detection with ShadCN dialog: Override | Save as new | Cancel
  - Meta modal (pencil icon): rename, alt, caption, description, and Categories (free tags with chip editor)
  - Image Editor (separate modal): configurable large image preview; Crop and Focal Point tools; variant selector with dimensions/filesize
  - Category filter dropdown (top-right): All + distinct categories (server-sourced)
  - Delete with ShadCN confirm (Admin-only); removes original and all variants
- ✅ Variants & image processing
  - Uses `sharp` to generate configured variants on upload and on demand
  - Renaming preserves/renames variant files and updates DB/JSON references
  - Crop (“Original image” only) creates a `cropped` variant and rebuilds all configured variants from the crop
  - Focal point (“Original image” only) recenters cover/crop variants
- ✅ Attachment tracking
  - “Where used” lists references across `module_instances.props` and `post_modules.overrides`
- ✅ Module integration
  - Media references in modules now store media IDs (not URLs)
  - `KitchenSink` module: image field stores ID and can choose a variant for rendering; frontend resolves via `GET /public/media/:id`

Env configuration:
- MEDIA_DERIVATIVES controls generated sizes (server-side). Comma-separated list of name:WxH with optional _crop:
  ```
  MEDIA_DERIVATIVES="thumb:200x200_crop,small:400x,medium:800x,large:1600x,hero:1920x1080_crop"
  ```
  - name: label for the variant (e.g., thumb, small, large, hero)
  - W and H: numbers; either or both (e.g., `800x`, `x600`)
  - `_crop`: forces fit=cover; otherwise fit=inside
- Admin display preferences (server-provided to client):
  ```
  MEDIA_ADMIN_THUMBNAIL_VARIANT=thumb
  MEDIA_ADMIN_MODAL_VARIANT=large
  ```
  - Thumbnail variant is used in the media grid preview
  - Modal variant is used in the Image Editor modal (falls back to largest available)

Upload behavior:
- Naming strategy (form-controlled): `naming=original|uuid` (UI toggle)
  - `original`: sanitizes filename and ensures uniqueness (counter or short id when duplicate)
  - `uuid`: uses a random UUID filename
- Duplicate handling: checks by `original_filename` and prompts (Override | Save as new | Cancel)
- Alt text default: derived from original filename (dashes/underscores → spaces)

How to test:
1. Set env and restart:
   - In `.env`, set MEDIA_DERIVATIVES, MEDIA_ADMIN_THUMBNAIL_VARIANT, MEDIA_ADMIN_MODAL_VARIANT
   - `npm run dev`
2. Open `/admin/media`:
   - Drag-drop upload a couple of images; verify previews, sizes, and dates
   - Toggle “Use original filename”; upload again; confirm storage name behavior
3. Duplicate flow:
   - Upload the same filename; choose Override → confirms and variants regenerate
   - Upload again; choose Save as new → confirms and filename gets a short-id suffix if needed
   - Upload again; choose Cancel → skipped
4. Edit modal:
   - Change alt/caption/description/categories → Save; verify grid label uses `alt` first
   - Rename file → confirm file and variant URLs update; references updated
5. Image Editor modal:
   - Confirm modal image uses `MEDIA_ADMIN_MODAL_VARIANT` (or largest)
   - Click Copy path → full URL in clipboard
   - Click Crop → draw selection → Apply crop → variants rebuild
   - Click Focal point → pick a center → Apply focal → cover variants re-center
6. Delete:
   - Delete item → confirm both original and all variant files removed from `/public/uploads`
7. Where used:
   - If an image is referenced in modules/overrides, verify appearances under “Where used”
8. Category filter:
   - Add a few categories to images (e.g., “Lorem”, “Ipsum”, “Dolor”) and Save
   - Use the Category dropdown (top-right) to filter: selecting a tag shows only media with that tag; reopening the dropdown still lists All + the full set of tags

### Milestone 17 — Global Modules & Locking (✅ Complete)
- Admin UI (`/admin/modules`):
  - Manage Global Modules (create, edit, delete with usage checks)
  - Primary “Add” flow: choose a base module type from the registry and enter a unique global slug
  - Usage counts per global; deletion disabled while referenced
- Add Module UI (post editor):
  - “Add Module” now has tabs:
    - Library — add a new local module instance
    - Globals — insert a reference to an existing Global Module (by slug)
- Locking (replaces “Static” as a governance concept):
  - Template editor supports Lock/Unlock per template module
  - Locked modules are editable but cannot be moved or removed in post module editors
  - Locking applies to both regular and global module placements seeded by templates

Scopes:
- Only two scopes are supported: local (post) and global. Use “Locked” in templates to prevent move/remove in posts. Rendering mode (SSR-only vs React) is separate from scope and does not appear in admin.

### Milestone 18 — Site Settings (Favicon, Branding, Defaults)
- Add `site_settings` table with:
  - `site_title`, `default_meta_description`
  - `favicon_media_id`, `default_og_media_id`
  - `logo_light_media_id`, `logo_dark_media_id`
- Admin UI: `/admin/settings/general`
  - Manage Site Title and Default Meta Description
  - Set Favicon (Media ID), Default OG (Media ID)
  - Upload/assign Logo assets (Media IDs) for light and dark themes
- API
  - `GET /api/site-settings` — returns current settings (auth required)
  - `PATCH /api/site-settings` — update settings (admin only)
- SSR exposure
  - `siteSettings` provided to public post pages (`site/post`) for layout/header usage
  - Logos are intended for theme-aware headers (light/dark). Use Media ID variants as needed.

### Milestone 19 — User Profiles & Role Controls
- User management (admin only)
  - Admin section to view and manage users
  - Reassign roles (admin, editor, translator, etc.)
  - Edit user account information
  - Reset/change passwords
- Post author management
  - Post detail includes an Author section (defaults to the post creator)
  - Admin-only action to switch/reassign the author
  - Author data is accessible to templates similarly to other post fields
- Profile post type
  - Define a dedicated `Profile` post type that serves as a user bio
  - Enforce one Profile per user
- Role-based enablement
  - Admin setting to enable/disable Profiles per role
  - Disabling Profiles for a role archives any existing Profiles for users with that role
- Account area integration
  - If Profiles are enabled and a user lacks a Profile, show a “Create Profile” call-to-action
  - Users with permission can create and edit their Profile
- RBAC consistency
  - Respect existing admin/editor permissions for visibility and actions

### Milestone 20 — Activity Log
All user activity should be logged and accessible via 'Admin' roles, in a well organized table. It might make sense to utilize https://github.com/holoyan/adonisjs-activitylog for this.

### Milestone 21 - Post Scheduling
The 'Scheduled' status should be fully functional, with a nice ShadCN datepicker for scheduling. We may want to utilize https://github.com/KABBOUCHI/adonisjs-scheduler for this, and possibly also https://packages.adonisjs.com/packages/adonisjs-jobs.


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


