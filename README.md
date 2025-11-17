# Adonis EOS — Custom CMS (AdonisJS + Inertia + React)

A high-performance, SEO-first CMS built with AdonisJS 6, Inertia, React, Tailwind, and ShadCN. Content is composed of modules (hero, callouts, etc.) that can be reordered, reused globally, or grouped into templates for rapid post creation.

Note: Role-based access control (RBAC) is out of scope for the initial milestones. Admin sections are protected by authentication only; roles/permissions will be added later.

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

### Milestone 8 — Admin Tools (✅ Partially Complete)
- ✅ Admin: URL pattern manager UI
- ✅ Admin: Redirects manager UI
- ⏳ Admin: Template builder
- ⏳ Admin: Locale configuration

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


