# Custom Fields

Adonis EOS supports **typed custom fields** on:

- posts (per post type)
- site (global)

This is distinct from **module props**: module props are defined by each module’s `propsSchema`, while custom fields are defined by post types (or site fields) and stored separately.

## Key files

- Field types (code-first): `app/fields/*` (registered by `start/fields.ts`)
- Post type custom fields:
  - post type configs: `app/post_types/*` (see `fields` in UI config)
  - values: `app/models/post_custom_field_value.ts` (`post_custom_field_values`)
  - loaded for editor UI in: `app/controllers/posts/posts_view_controller.ts`
- Site custom fields (code-first):
  - field definitions: `app/site/fields.ts`
  - values: `app/models/site_custom_field_value.ts` (`site_custom_field_values`)
  - service: `app/services/site_custom_fields_service.ts`
- Site settings (global key/value):
  - model: `app/models/site_setting.ts` (`site_settings`)
  - service: `app/services/site_settings_service.ts`
  - controller: `app/controllers/site_settings_controller.ts`

## Field types (shared)

Field types (text/select/media/etc.) live in `app/fields/*` and are registered on boot via `start/fields.ts`.
They provide admin rendering + value validation/normalization.

Examples include:

- `text`, `textarea`, `select`, `number`, `boolean`
- `media`, `file`, `link`, `url`
- `post_reference`, `taxonomy_reference`, `form_reference`, `richtext`, `slider`

## Post custom fields (per post type)

A post type can declare a `fields` array in its UI config (via `app/post_types/*` → `postTypeConfigService.getUiConfig()`).

Values are stored per post in `post_custom_field_values` keyed by `post_id` + `field_slug`.

Where they appear:
- Admin post editor loads these fields and their values based on post type config.
- You can include these values in rendering/serialization where needed.

## Site custom fields (global)

Site fields are code-first and defined in `app/site/fields.ts`.

They are useful for:
- footer content
- announcement banners
- shared contact info / links
- feature flags (booleans) used by the frontend

Values are stored in `site_custom_field_values`.

## Site settings (global)

Site settings are global key/value configuration used for rendering and admin defaults.

Typical examples:
- brand name
- default SEO values
- social links

## Modules vs custom fields (how to choose)

- Use **module props** when the data belongs to a specific section of a page/layout.
- Use **post custom fields** when the data is “post metadata” that shouldn’t live in a content block.
- Use **site custom fields** for global reusable values used across the site.
- Use **site settings** for system-wide config and defaults.


