# Custom CMS Plan (AdonisJS + Inertia + React)

## Vision
A high-performance, SEO-first CMS built with **AdonisJS 6 + Inertia + React**, styled with **TailwindCSS** and **ShadCN**. Content is composed of **modules** (hero, callouts, etc.) that can be reordered, reused globally, or grouped into **templates** for fast post creation.

Key priorities:
- Performance & SEO (SSR, structured data, caching)
- Editor ease-of-use (drag-and-drop, module templates)
- Developer clarity (consistent naming, per-module models, strong typing)

---

## Technical Stack
- **Backend:** AdonisJS 6 (Lucid ORM, Validator, Bouncer)
- **Frontend:** Inertia + React
- **Styling:** Tailwind (dark/light modes via `class` strategy)
- **Forms:** ShadCN + Zod for validation
- **DnD:** dnd-kit (sortable)
- **Rich Text:** Lexical (stored as JSON, rendered SSR to HTML)
- **Database:** PostgreSQL
- **Caching:** CDN + per-module render cache

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
- **Policies:** Admin-only pages guarded via Bouncer roles.

---

## Core Concepts

### Posts
- Posts represent content of different **types**: `page`, `blog`, `testimonial`, `product`, etc.
- Posts are composed of **modules** ordered via `post_modules`.
- SEO data (meta title, description, canonical, robots) is stored per post.

### Modules
- Modules are reusable building blocks of content.
- Each has:
  - `type` (e.g. `hero`, `text-callout`)
  - `props` (typed via Zod schema)
  - Associated **Model**, **Renderer**, and **Editor**
- **Global modules** (scope = `global`) can be reused across posts by slug.
- **Static modules** (scope = `static`) are fixed site-wide (e.g., header, footer).
- **Local modules** (scope = `post`) belong only to a post.
- Some modules can be **restricted by post type** using `module_type_scopes` (e.g., a `testimonial-overview` module may only be used for the `testimonial` post type).

### Post Modules
- The join table that defines:
  - Which modules a post uses
  - Their order (`order_index`)
  - Optional shallow `overrides` of props for global modules

### Module Templates
- A **template** is a collection of modules (with default props) used to seed new posts.
- Templates are tied to a **post type** (e.g., `blog`).
- Each module in a template can be **locked**, preventing removal.
- A **locked template** prevents any module additions/removals on posts using it.

---

## Database Schema

### posts
- id (uuid)
- type (text)
- slug (unique)
- title
- status (`draft`, `review`, `scheduled`, `published`, `archived`)
- meta_title, meta_description, canonical_url, robots_json
- jsonld_overrides (jsonb)
- template_id (fk → module_templates)
- published_at, scheduled_at
- created_at, updated_at

### module_instances
- id (uuid)
- scope (`post`, `global`, `static`)
- type (text)
- post_id (nullable, fk → posts)
- global_slug (unique when scope=global)
- props (jsonb)
- render_cache_html, render_etag
- created_at, updated_at

### post_modules
- id (uuid)
- post_id (fk → posts)
- module_id (fk → module_instances)
- order_index (int)
- overrides (jsonb)
- created_at, updated_at

### module_templates
- id (uuid)
- name (unique slug)
- post_type (text)
- description
- **locked** (boolean, default false)
- created_at, updated_at

### module_template_modules
- id (uuid)
- template_id (fk → module_templates)
- type (text)
- default_props (jsonb)
- order_index (int)
- **locked** (boolean, default false)

### permalink_patterns
- id (uuid)
- post_type (text)
- pattern (text) – e.g. `/blog/{yyyy}/{slug}`
- is_default (boolean)
- created_at, updated_at

### redirects
- id (uuid)
- from_path (unique)
- to_path (text)
- http_status (int, default 301)
- post_id (nullable fk → posts)
- active_from (timestamptz), active_to (timestamptz)
- created_at, updated_at

### module_type_scopes
- id (uuid)
- module_type (text)
- post_type (text)
- unique(module_type, post_type)

### custom_fields
- id (uuid)
- slug (text)
- label (text)
- field_type (enum: text, textarea, number, select, multiselect, media, date, url)
- config (jsonb)

### post_type_custom_fields
- id (uuid)
- post_type (text)
- field_id (fk → custom_fields)
- unique(post_type, field_id)

### post_custom_field_values
- id (uuid)
- post_id (fk → posts)
- field_id (fk → custom_fields)
- value (jsonb)
- unique(post_id, field_id)

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
- **Permalink editing:** edit per-post slug and view computed pattern
- **Dark/Light mode** toggle (persisted per user)

---

## API
- `GET /api/modules/registry` – list module schemas + allowed post types
- `POST /api/posts` – create post (optional template)
- `PUT /api/posts/:id`
- `GET /api/posts/:slug`
- `POST /api/posts/:id/modules` – add module (local/global/static)
- `PUT /api/post-modules/:id` – reorder or update overrides
- `POST /api/modules/global` – create/update global module
- `GET /api/modules/global/:slug`
- `POST /api/posts/:id/publish`
- **Permalinks:** `GET /api/permalinks/patterns`, `PUT /api/permalinks/patterns/:id`
- **Redirects:** `POST /api/redirects`, `GET /api/redirects`, `DELETE /api/redirects/:id`

---

## Rendering Pipeline
1. Fetch ordered `post_modules` joined with `module_instances`
2. Enforce `module_type_scopes` by post type
3. Merge `props` + `overrides`
4. Resolve `custom_fields` referenced in module props
5. Render via module Renderer (SSR)
6. Use cached HTML if valid
7. Combine module JSON-LD with post-level SEO
8. Generate URL from `permalink_patterns`; redirect if needed

---

## SEO & Performance
- SSR HTML (crawler-friendly)
- JSON-LD per module (FAQ, HowTo, etc.)
- Open Graph & Twitter metadata
- Canonical & robots management
- Responsive images with AVIF/WebP, lazy load, priority hints
- Caching: per-module cache + CDN cache by path
- **Permalinks:** auto 301 when slugs change
- **Redirects:** middleware lookup, short-circuit before controller

---

## Next Steps
1. Implement migrations (including permalinks, redirects, custom fields)
2. Build ModuleModel base + `ModuleHero` + `ModuleProse` (Lexical)
3. Implement locked template & module logic
4. Editor: DnD modules, locks UI, custom fields panel, sidebar
5. Admin: permalink manager, redirects manager
6. Ship MVP with SSR, SEO, caching, templates, and routing

