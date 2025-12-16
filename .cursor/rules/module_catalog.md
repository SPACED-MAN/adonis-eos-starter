# Module Catalog Seeding Rule

## Purpose

The **Module Catalog** page is a development helper page that showcases all available content modules with representative configurations. It is intended for:

- Visual QA and regression checks when modifying module layouts
- Quickly seeing how modules behave together on a single page
- Serving as a reference when designing new modules

## Required Step When Adding or Modifying Modules

Whenever you **add a new module type** or make a **significant change to an existing module’s layout**, you must also:

1. **Seed or update the "Module Catalog" page** so it includes a sample instance of that module.
2. Keep the catalog content **simple, neutral, and token-based** (use project Tailwind tokens like `bg-backdrop-low`, `text-neutral-high`, `bg-standout`, etc., not arbitrary colors).

## Implementation Notes

- The current catalog is seeded in `database/seeders/smoke_test_seeder.ts`:
  - Post: `type: 'page'`, `slug: 'module-catalog'`, `locale: 'en'`
  - Modules attached via `module_instances` + `post_modules`
- When introducing a new module:
  - Add a **deterministic, minimal props object** for that module type in the catalog seeding block.
  - Attach it to the catalog post with a sensible `order_index`.
  - Avoid depending on optional data (e.g., media IDs) that may not exist in a fresh database.

## AI / Automation Guidance

When AI assistance or automation tools create a new module (backend + frontend):

- **Also update** the Module Catalog seeding logic to include:
  - One well-chosen instance of the new module with representative props.
  - Ordering that keeps the page readable (group similar modules together where possible).
- If adding a whole family of modules, it is acceptable to:
  - Seed only **one canonical example** from that family, or
  - Group them together with brief, self-explanatory titles.
