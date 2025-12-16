# Menus

Adonis EOS supports navigation menus with:

- code-first menu templates (`app/menus/*`)
- database-backed menus + items (`menus`, `menu_items`)
- public rendering via the site menu components

## Key files

- Menu templates: `app/menus/*`
- Template registry: `app/services/menu_template_registry.ts`
- Admin controller: `app/controllers/menus_controller.ts`
- Frontend: `inertia/site/components/menu/*`

## Concepts

### Menu templates (code-first)

Templates define the *shape* and defaults for menus. They are registered on boot and used by the admin UI for creation/validation.

### Menu instances (DB)

Menus and items live in the database:

- `menus`: slug/name + metadata
- `menu_items`: hierarchical items (nesting) that point to URLs or post references

## Developer workflow

- Add a new menu template via:
  - `node ace make:menu "Footer"`
  - update `app/menus/<slug>.ts` as needed
- Seed or create the menu in admin UI.
- Render on the public site via menu components.


