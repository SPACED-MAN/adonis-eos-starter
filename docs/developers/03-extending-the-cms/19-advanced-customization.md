# Advanced Customization

For one-off experiences and dynamic content injection, Adonis EOS provides **Override Pages** and **Template Tokens**.

---

## 1. Override Pages

Override pages allow you to render a dedicated **Inertia page component** for a specific CMS post (by `type` + `slug`) instead of the generic `site/post` renderer.

### Use Cases

- Campaign landing pages with unique layouts.
- Custom interactive tools (calculators, configurators).
- Complex data visualizations.

### Implementation

1. **Create the Component**: Add your component to `inertia/site/pages/overrides/` (e.g., `page-campaign.tsx`).
2. **Register the Mapping**: Update `app/services/site_inertia_overrides_service.ts`:

```typescript
// app/services/site_inertia_overrides_service.ts
export function getSiteInertiaOverrideForPost(postType: string, slug: string) {
  const mapping: Record<string, string> = {
    'page:my-special-slug': 'site/overrides/page-campaign',
  }
  return mapping[`${postType}:${slug}`] || null
}
```

### Site Chrome

Override pages should still import and use `SiteHeader` and `SiteFooter` to maintain brand consistency.

---

## 2. Template Tokens

Tokens allow you to inject dynamic data into strings using the `{token}` syntax. These are resolved on the server during the rendering phase.

### Usage

Tokens can be used in:

- Post titles, excerpts, and meta fields.
- Module props and overrides.
- SEO fields.

### Available Tokens

| Token Category    | Examples                                                    |
| :---------------- | :---------------------------------------------------------- |
| **Post Data**     | `{title}`, `{slug}`, `{excerpt}`, `{id}`, `{locale}`        |
| **Custom Fields** | `{custom.field_slug}`                                       |
| **Site Settings** | `{settings.siteTitle}`, `{settings.defaultMetaDescription}` |
| **System**        | `{now}` (ISO timestamp), `{year}`                           |

### Resolution Logic

Server-side resolution happens in `app/services/post_rendering_service.ts` using `TokenService`. Tokens that cannot be resolved are left as-is in the final output.

### Admin UI Support

In the CMS Editor, fields that support tokens often use the `TokenField` component, which includes a visual picker for easy insertion.
