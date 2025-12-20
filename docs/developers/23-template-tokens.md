# Template Tokens

Adonis EOS supports **template tokens** (simple variables) inside strings using `{token}` syntax.

Tokens are resolved on the server during public rendering, allowing lightweight templating for:

- Post fields (title, excerpt, meta fields)
- Module props and overrides
- SEO fields (canonical URL, meta, OpenGraph/Twitter)

## Syntax

- Tokens use curly braces: `{title}`
- Unknown tokens are left as-is (not removed)

## Where tokens are resolved

Server-side token resolution occurs in `app/services/post_rendering_service.ts` using `TokenService.resolveRecursive(...)`.

Resolution is applied to:

- The resolved post data (`post`)
- Modules (`modules[*].props` and `modules[*].overrides`)
- SEO payload (`seo`)

## Available tokens

### Post tokens

- `{title}`
- `{slug}`
- `{excerpt}`
- `{locale}`
- `{type}`
- `{id}`

You can also use the `post.` prefix:

- `{post.title}`, `{post.slug}`, etc.

### Custom field tokens

Custom fields can be referenced by slug:

- `{custom.<fieldSlug>}`

Example:

- `{custom.hero_heading}`

### Site settings tokens

Site settings can be referenced by key:

- `{settings.siteTitle}`
- `{settings.defaultMetaDescription}`

### System tokens

- `{now}` (ISO datetime)
- `{year}` (year number)

## Admin UI support

In the admin, some inputs use `TokenField`, which provides a token picker and inserts `{token}` strings into the input.

Key files:

- `inertia/admin/components/ui/TokenField.tsx`
- `inertia/lib/tokens.ts`

## Notes / gotchas

- Tokens are string substitutions; they do not execute code.
- Avoid overusing tokens—use them for small, obvious substitutions.
- Token resolution includes a guard against simple self-references.


