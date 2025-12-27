# Custom Fields

Adonis EOS uses a **unified Custom Field system**. Whether you are adding metadata to a Post or defining the content of a Module, you use the exact same schema language and rendering engine.

The system supports fields on:

- **Posts** (Entity metadata)
- **Site** (Global configuration)
- **Taxonomy Terms** (Category/Tag metadata)
- **Menus** (Navigation metadata)
- **Modules** (Block-level content fields)

## Shared Definition

All fields are defined using the `CustomFieldDefinition` interface:

```typescript
export interface CustomFieldDefinition {
  slug: string // Unique identifier (used as property name in Modules)
  label?: string // Display name (auto-humanized from slug if omitted)
  type: CustomFieldType
  category?: string // Optional grouping in admin UI
  translatable?: boolean
  required?: boolean
  placeholder?: string
  options?: Array<{ label: string; value: any }>
  fields?: CustomFieldDefinition[] // For 'object' type
  item?: CustomFieldDefinition // For 'repeater' type
  showIf?: {
    // Conditional visibility
    field: string
    equals?: any
    notEquals?: any
  }
  config?: Record<string, any> // Type-specific configuration
}
```

## Key files

- Field types (code-first): `app/fields/*` (registered by `start/fields.ts`)
- Post type custom fields:
  - post type configs: `app/post_types/*` (see `fields` in UI config)
  - values: `app/models/post_custom_field_value.ts` (`post_custom_field_values`)
- Site custom fields (code-first):
  - field definitions: `app/site/fields.ts`
  - values: `app/models/site_custom_field_value.ts` (`site_custom_field_values`)
- Taxonomy custom fields:
  - taxonomy configs: `app/taxonomies/*`
  - values: `app/models/taxonomy_term_custom_field_value.ts` (`taxonomy_term_custom_field_values`)
- Menu custom fields:
  - menu templates: `app/menus/*`
  - values: `menus.meta_json` (JSONB column)
- Module properties:
  - module configs: `app/modules/*` (via `fieldSchema`)
  - values: `post_modules.props` (JSONB column)

## Categories & Grouping

All custom fields support an optional `category` property. This is used in the admin editor to group related fields under a labeled section.

```typescript
{
  slug: 'footer_copyright',
  label: 'Copyright Text',
  type: 'text',
  category: 'Footer' // Fields with the same category are grouped together
}
```

If a category is not provided, the field will appear in a default "General" group.

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

## Choosing a location for your fields

While the definition is unified, where you place your fields depends on the data's scope:

- Use **Module Fields** when the data belongs to a specific section of a page/layout.
- Use **Post Custom Fields** when the data is “post metadata” that shouldn’t live in a content block (e.g., SEO fields, page settings).
- Use **Site Custom Fields** for global reusable values used across the site (e.g., footer contact info).
- Use **Taxonomy Custom Fields** for metadata specific to a category or tag (e.g., a category color or thumbnail).
- Use **Menu Custom Fields** for metadata specific to a menu template (e.g., a "mega-menu" boolean).
- Use **Site Settings** for system-wide config and defaults.
