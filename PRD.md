# Custom CMS Plan (AdonisJS + Inertia + React)

## Vision
A high-performance, SEO-first, **multilingual** CMS built with **AdonisJS 6 + Inertia + React**, styled with **TailwindCSS** and **ShadCN**. Content is composed of **modules** (hero, callouts, etc.) that can be reordered, reused globally, or grouped into **module groups** for fast post creation.

Key priorities:
- Performance & SEO (SSR, structured data, caching)
- Internationalization (i18n) with locale-specific URLs
- Editor ease-of-use (drag-and-drop, module groups)
- Developer clarity (consistent naming, per-module models, strong typing)

---

## Technical Stack
- **Server:** AdonisJS 6 (Lucid ORM, Validator, Bouncer, SSR)
- **Client:** Inertia + React
  - Admin Panel: `inertia/admin/*` (content management)
  - Public Site: `inertia/site/*` (visitor-facing)
- **Styling:** Tailwind (dark/light modes via `class` strategy)
- **Forms:** ShadCN + Zod for validation
- **DnD:** dnd-kit (sortable)
- **Rich Text:** Lexical (stored as JSON, rendered SSR to HTML)
- **Database:** PostgreSQL with GIN indexes for JSONB
- **Caching:** CDN + per-module render cache
- **i18n:** Locale-based content and URL routing

### Project structure (Inertia, admin vs site)
```
inertia/
  admin/               # Inertia admin app (bundled separately)
    pages/
    components/
    layouts/AdminLayout.tsx
  site/                # Inertia public app
    pages/
    modules/           # Renderers per module type
    components/
    layouts/SiteLayout.tsx
```
 - **Vite entries:** two inputs (admin, site) for code splitting.
 - **Policies:** Admin-only pages guarded via authentication and Bouncer policies (RBAC to be added in a later milestone).

---

## Core Concepts

### Posts
- Posts represent content of different **types**: `page`, `blog`, `testimonial`, `product`, etc.
- Posts are composed of **modules** ordered via `post_modules`.
- SEO data (meta title, description, canonical, robots) is stored per post.
- **Translatable:** Posts can have translations for different locales.

### Modules
- Modules are reusable building blocks of content.
- Each has:
  - `type` (e.g. `hero`, `text-callout`)
  - `props` (typed via Zod schema)
  - Associated **Model**, **Renderer**, and **Editor**
- **Global modules** (scope = `global`) can be reused across posts by slug.
- **Local modules** (scope = `post`) belong only to a post.
- Some modules can be **restricted by post type** using `module_scopes` (e.g., a `testimonial-overview` module may only be used for the `testimonial` post type).
- **Translatable:** Module props can contain locale-specific content.

### Post Modules
- The join table that defines:
  - Which modules a post uses
  - Their order (`order_index`)
  - Optional shallow `overrides` of props for global modules

### Templates
- A **template** is a collection of modules (with default props) used to seed new posts.
- Templates are tied to a **post type** (e.g., `blog`).
- Each module in a template can be **locked**, preventing removal.
- A **locked template** prevents any module additions/removals on posts using it.

### Internationalization (i18n)
- **Locales:** Configured locales (e.g., `en`, `es`, `fr`) with default fallback.
- **Content Translation:** Posts and modules have translations stored separately.
- **URL Routing:** Locale-specific URL patterns (e.g., `/en/blog/...`, `/es/blog/...`).
- **Fallback Logic:** If translation missing, system falls back to default locale.
- **SEO:** Each locale has its own meta tags and hreflang tags.

---

## Database Schema

### posts
- id (uuid)
- type (text)
- slug (unique)
- title
- status (`draft`, `review`, `scheduled`, `published`, `archived`)
- locale (text, default 'en')
- translation_of_id (nullable, fk → posts, self-referencing)
- meta_title, meta_description, canonical_url, robots_json
- jsonld_overrides (jsonb)
- module_group_id (fk → module_groups)
- published_at, scheduled_at
- created_at, updated_at

**Description:** The core content table that stores all posts regardless of type (blog, page, product, testimonial, etc.). Each post has a type, unique slug, SEO metadata, publishing workflow status, and can optionally be created from a module group. Posts are composed of modules via the `post_modules` join table. The `locale` field indicates the post's language, and `translation_of_id` links translations to their source post.

**Performance:** Indexed on (locale, status, type) for efficient filtering. Composite index on (translation_of_id, locale) for fast translation lookups.

### module_instances
- id (uuid)
- scope (`post`, `global`, `static`)
- type (text)
- post_id (nullable, fk → posts)
- global_slug (unique when scope=global)
- props (jsonb)
- render_cache_html, render_etag
- created_at, updated_at

**Description:** Stores individual module instances - the reusable building blocks of content. Modules can be **local** (belong to one post), **global** (reusable across posts by slug), or **static** (site-wide like headers/footers). The `props` field contains the module's configuration and data, including locale-specific content as nested objects. Caching fields store pre-rendered HTML and ETags for performance.

**Performance:** GIN index on `props` for efficient JSONB queries. Index on (scope, type) for module filtering.

### post_modules
- id (uuid)
- post_id (fk → posts)
- module_id (fk → module_instances)
- order_index (int)
- overrides (jsonb)
- created_at, updated_at

**Description:** The join table that defines which modules a post uses, their display order, and per-post customizations. The `overrides` field allows shallow modifications to global/static modules without changing the original, enabling per-post customization while maintaining reusability.

**Performance:** Composite index on (post_id, order_index) for efficient ordered retrieval when rendering pages. This is critical for page load performance.

### module_groups
- id (uuid)
- name (unique slug)
- post_type (text)
- description
- **locked** (boolean, default false)
- created_at, updated_at

**Description:** Defines reusable module groups that seed new posts with a pre-configured set of modules. For example, a "blog-post" group might include a hero, prose content, and author bio modules. When `locked` is true, posts using this group cannot add or remove modules, enforcing a consistent structure.

**Performance:** Index on (post_type) for module group filtering.

### module_group_modules
- id (uuid)
- module_group_id (fk → module_groups)
- type (text)
- default_props (jsonb)
- order_index (int)
- **locked** (boolean, default false)

**Description:** Defines which modules are included in a module group, their default configuration, and display order. Individual modules can be `locked`, preventing their removal from posts that use the group while still allowing other modules to be added/removed (unless the group itself is locked).

**Performance:** Composite index on (module_group_id, order_index) for ordered retrieval.

### url_patterns
- id (uuid)
- post_type (text)
- locale (text, default 'en')
- pattern (text) – e.g. `/blog/{yyyy}/{slug}` or `/es/blog/{yyyy}/{slug}`
- is_default (boolean)
- created_at, updated_at

**Description:** Defines URL structure patterns for different post types and locales. Supports variables like `{yyyy}` (year), `{mm}` (month), `{slug}`, etc. Each post type can have multiple patterns per locale, but only one should be marked as default per type/locale combination. When a post's slug changes, the system can automatically create redirects from old URLs.

**Performance:** Composite unique index on (post_type, locale, is_default) to enforce one default per type/locale.

### url_redirects
- id (uuid)
- from_path (unique)
- to_path (text)
- http_status (int, default 301)
- locale (nullable, text)
- post_id (nullable fk → posts)
- active_from (timestamptz), active_to (timestamptz)
- created_at, updated_at

**Description:** Manages URL redirects (301/302) for the site. Can be manually created or automatically generated when post slugs change. The `post_id` links auto-generated redirects to their source post. The `locale` field enables locale-specific redirects. Time-based activation allows scheduling redirects to become active/inactive at specific times, useful for campaigns or temporary changes.

**Performance:** Index on (from_path, locale) for fast redirect lookups in middleware. This is critical as redirects are checked on every request.

### module_scopes
- id (uuid)
- module_type (text)
- post_type (text)
- unique(module_type, post_type)

**Description:** Restricts which module types can be used with which post types. For example, a "testimonial-grid" module might only make sense on a "testimonial" overview page. If a module type is listed here for a post type, it can be used; if not listed and restrictions exist for that module type, it cannot be used. This enforces content structure rules.

**Performance:** Composite unique index on (module_type, post_type) prevents duplicate restrictions.

### custom_fields
- id (uuid)
- slug (text)
- label (text)
- field_type (enum: text, textarea, number, select, multiselect, media, date, url)
- config (jsonb)
- translatable (boolean, default false)

**Description:** Defines reusable custom field definitions that can be attached to post types. For example, a "featured_image" field of type "media" or an "author_bio" field of type "textarea". The `config` field stores field-specific settings like validation rules, select options, max length, etc. The `translatable` flag indicates whether this field should have locale-specific values.

**Performance:** Index on (slug) for quick lookups.

### post_type_custom_fields
- id (uuid)
- post_type (text)
- field_id (fk → custom_fields)
- unique(post_type, field_id)

**Description:** The join table that attaches custom field definitions to specific post types. For example, "blog" posts might have an "author_bio" field, while "product" posts might have "price" and "sku" fields. This allows different post types to have different metadata requirements. This three-table design (custom_fields → post_type_custom_fields → post_custom_field_values) provides maximum flexibility: fields are reusable across post types, attachment is explicit, and values are stored with proper constraints.

**Performance:** Composite index on (post_type, field_id) for efficient lookups when loading post type schemas.

### post_custom_field_values
- id (uuid)
- post_id (fk → posts)
- field_id (fk → custom_fields)
- value (jsonb)
- unique(post_id, field_id)

**Description:** Stores the actual values of custom fields for individual posts. The `value` is stored as JSONB to support any field type (text, arrays for multiselect, objects for complex data). For translatable fields, the value object contains locale keys: `{ "en": "English value", "es": "Spanish value" }`. Each post can only have one value per custom field, enforced by the unique constraint.

**Performance:** GIN index on `value` for efficient JSONB queries. Composite index on (post_id, field_id) for fast field value lookups.

---

## Performance Considerations

### Indexes Strategy
1. **Primary Indexes:** UUID PKs on all tables (good for distributed systems, minimal overhead)
2. **Foreign Key Indexes:** All FK columns are indexed for efficient joins
3. **Composite Indexes:**
   - `post_modules(post_id, order_index)` - Critical for page rendering
   - `posts(locale, status, type)` - For filtered content lists
   - `posts(translation_of_id, locale)` - For translation lookups
   - `url_patterns(post_type, locale, is_default)` - For URL generation
   - `module_group_modules(module_group_id, order_index)` - For module_group loading
4. **JSONB Indexes:**
   - GIN indexes on `props`, `overrides`, `value` columns for JSONB querying
   - Enables efficient searches within JSON data
5. **Unique Constraints:** Enforce data integrity and also create indexes

### Page Load Query Path
```
1. Lookup URL → resolve locale & post (indexed: url_redirects, posts.slug)
2. Load post → JOIN post_modules (indexed: post_modules.post_id)
3. Load modules → JOIN module_instances (indexed: module_instances.id)
4. Load custom fields → JOIN post_custom_field_values (indexed: post_id)
5. Check render cache → use cached HTML if valid
```

**Total queries:** 3-4 with proper eager loading
**Expected response time:** < 50ms with cache hits, < 200ms cold

### Caching Strategy
- **Module-level cache:** Cached HTML per module + ETag
- **Page-level cache:** CDN caching by full URL path
- **JSONB advantage:** Props stored as JSONB allow efficient partial updates without full re-renders

---

## Internationalization (i18n) Strategy

### Locale Management
- **Supported Locales:** Configured via environment (e.g., `LOCALES=en,es,fr,de`)
- **Default Locale:** One locale marked as default (fallback)
- **Locale Detection:** 
  1. URL prefix (`/es/blog/...`)
  2. Domain (`es.example.com`)
  3. Accept-Language header
  4. User preference (stored in session)

### Content Translation
- **Posts:** Each translation is a separate post record linked via `translation_of_id`
- **Modules:** Translation props stored in JSONB: `{ "en": {...}, "es": {...} }`
- **Custom Fields:** Translatable fields store values as: `{ "en": "value", "es": "valor" }`
- **Fallback:** If translation missing, system uses default locale content

### URL Structure
Options (configurable per deployment):
1. **Prefix:** `/en/blog/post-slug`, `/es/blog/post-slug`
2. **Domain:** `en.example.com/blog/post-slug`, `es.example.com/blog/post-slug`
3. **Query:** `/blog/post-slug?lang=es` (least SEO-friendly)

Recommendation: Use prefix approach with locale subdirectories.

### SEO for i18n
- **hreflang tags:** Auto-generated for all translations
- **Canonical URLs:** Locale-specific canonicals
- **Sitemap:** Separate sitemaps per locale
- **Robots.txt:** Locale-aware (if needed)

---

## Editor Experience
- **Sortable module list** (local + global + static) with drag-and-drop
- **Add module** picker:
  - Local (new instance)
  - Global (select existing by slug)
  - Static (if allowed by template)
- **Locks:**
  - Lock a module → cannot remove in seeded posts
  - Lock a template → prevents add/remove of modules in posts using it
- **Custom fields panel:** per post type, attachable to modules
- **Global module editing:** banner indicates global changes
- **Overrides:** shallow per-post changes for global/static
- **Templates:** selected at post creation; seeds modules automatically
- **URL editing:** edit per-post slug and view computed pattern
- **Dark/Light mode** toggle (persisted per user)
- **Translation editor:** Side-by-side translation interface with fallback preview
- **Locale switcher:** Quick switching between locales when editing

---

## API

### Core Content
- `GET /api/modules/registry` – list module schemas + allowed post types
- `POST /api/posts` – create post (optional template, optional locale)
- `PUT /api/posts/:id` – update post
- `GET /api/posts/:slug` – get post by slug
- `GET /api/posts/:id/translations` – list all translations of a post
- `POST /api/posts/:id/translations` – create translation
- `POST /api/posts/:id/modules` – add module (local/global/static)
- `PUT /api/post-modules/:id` – reorder or update overrides
- `POST /api/modules/global` – create/update global module
- `GET /api/modules/global/:slug`
- `POST /api/posts/:id/publish`

### URL Management
- `GET /api/url-patterns` – list URL patterns
- `POST /api/url-patterns` – create URL pattern
- `PUT /api/url-patterns/:id` – update URL pattern
- `GET /api/url-redirects` – list redirects
- `POST /api/url-redirects` – create redirect
- `DELETE /api/url-redirects/:id` – delete redirect

### i18n
- `GET /api/locales` – list configured locales
- `GET /api/locales/default` – get default locale

---

## Rendering Pipeline
1. Detect locale from URL/domain/headers
2. Fetch ordered `post_modules` joined with `module_instances`
3. Enforce `module_scopes` by post type
4. Merge `props` + `overrides` + locale-specific content
5. Resolve `custom_fields` referenced in module props (with locale fallback)
6. Render via module Renderer (SSR) with locale context
7. Use cached HTML if valid (cache key includes locale)
8. Combine module JSON-LD with post-level SEO
9. Generate URL from `url_patterns` (locale-specific)
10. Add hreflang tags for all translations
11. Check `url_redirects` and redirect if needed

---

## SEO & Performance
- SSR HTML (crawler-friendly)
- JSON-LD per module (FAQ, HowTo, etc.)
- Open Graph & Twitter metadata (locale-specific)
- Canonical & robots management (locale-aware)
- **hreflang tags:** Auto-generated for all translations
- Responsive images with AVIF/WebP, lazy load, priority hints
- Caching: per-module cache + CDN cache by path (locale-aware)
- **URL patterns:** auto 301 when slugs change
- **URL redirects:** middleware lookup, short-circuit before controller
- GIN indexes on JSONB for efficient queries
- Composite indexes on frequently joined columns

 ---
 
 ## Out of Scope (Initial Release)
 - **Role-Based Access Control (RBAC):** User roles (e.g., Admin, Editor) and granular permissions are not included in the initial scope and will be implemented in a later milestone. Initial admin access will be protected via authentication without role differentiation.
 
 ## Next Steps
1. Implement migrations (renamed tables, i18n fields, performance indexes)
2. Build ModuleModel base + `ModuleHero` + `ModuleProse` (Lexical)
3. Implement locked template & module logic
4. Add i18n: locale detection, translation UI, hreflang generation
5. Editor: DnD modules, locks UI, custom fields panel, sidebar, translation interface
6. Admin: URL pattern manager, redirects manager
7. Ship MVP with SSR, SEO, caching, module groups, routing, and i18n

