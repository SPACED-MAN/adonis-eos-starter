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

### Milestone 2 — Database Schema
- Create migrations for:
  - `posts`, `module_instances`, `post_modules`, `module_templates`, `module_template_modules`
  - `permalink_patterns`, `redirects`
  - `custom_fields`, `post_type_custom_fields`, `post_custom_field_values`

How to test:
1. Run: `node ace migration:run`
2. Verify tables exist in PostgreSQL.
3. Add a smoke seed (optional) and run `node ace db:seed`; verify constraints.

### Milestone 3 — Module System (Backend & SSR)
- Implement ModuleModel base + registry
- Implement `ModuleHero` and `ModuleProse` with SSR
- Implement render pipeline (merge props/overrides, JSON-LD, cache hooks)
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

### Milestone 4 — Admin Editor MVP
- Inertia Admin:
  - DnD sortable module list (local/global/static)
  - Module picker (local/global/static)
  - Locks UI (module-level, template-level)
  - Overrides panel
  - Custom fields panel
  - Dark/Light toggle (persisted per user)

How to test:
1. Login and visit admin editor for a post.
2. Add/reorder modules (local/global/static) and verify persistence.
3. Apply locks; ensure locked behavior is enforced.
4. Edit overrides; confirm merged output in render.
5. Toggle dark/light and confirm persistence.

### Milestone 5 — SEO & Routing
- Canonical/robots management; OG/Twitter metadata
- JSON-LD per module + post-level SEO merge
- Permalink patterns:
  - `GET /api/permalinks/patterns`, `PUT /api/permalinks/patterns/:id`
  - Apply URL generation and automatic 301 on slug change
- Redirects middleware and APIs

How to test:
1. Configure a permalink pattern for a post type; create a post and verify URL.
2. Change slug; confirm 301 is issued and destination resolves.
3. Create redirect rules; verify middleware short-circuits with expected status.
4. View page source; verify meta tags and JSON-LD presence.

### Milestone 6 — Caching & Performance
- Per-module render cache (HTML + ETag)
- CDN-friendly caching by path
- Image performance: AVIF/WebP, lazy load, priority hints

How to test:
1. Warm a page; reload and verify cache headers/ETag behavior.
2. Invalidate a module and verify re-render.
3. Confirm image formats and lazy-loading in DOM.

### Milestone 7 — Admin Tools
- Admin: Permalink manager UI
- Admin: Redirects manager UI

How to test:
1. Change permalink patterns via UI; verify affected routes.
2. Create/delete redirects via UI; verify middleware behavior.

### Milestone 8 — RBAC (Future Scope)
- Introduce roles (Admin, Editor, etc.) and permissions
- Enforce role-based access with Bouncer

How to test:
1. Create users with different roles.
2. Verify editor access, editing capabilities, and UI visibility vary by role.

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


