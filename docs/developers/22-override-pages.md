# Override Pages (Site)

Override pages let you render a dedicated **Inertia page component** for a specific CMS post (by `post.type` + `post.slug`) instead of the generic `site/post` renderer.

This is intended for rare one-off experiences (campaign pages, custom interactions, complex layouts) while still keeping the content as a normal Post in the CMS (SEO, modules, permissions, etc.).

## How it works

Public post requests are resolved through `PostsViewController.resolve`:

- The post is resolved via URL patterns.
- The server builds standard page props (`post`, `modules`, `seo`, `siteSettings`, etc.).
- Before rendering, it checks for an override mapping.

If an override exists, the response renders the override component. Otherwise it renders the default post page:

- Default: `site/post`
- Override: `site/overrides/<name>`

## Key files

- Override mapping: `app/services/site_inertia_overrides_service.ts`
- Public resolver: `app/controllers/posts/posts_view_controller.ts`
- Override pages folder: `inertia/site/pages/overrides/`

## Add an override page

1. **Create an override page component**

- Example: `inertia/site/pages/overrides/page-lorem-ipsum.tsx`

2. **Register it in the mapping**

In `getSiteInertiaOverrideForPost(postType, slug)`:

- Map `page:lorem-ipsum` → `site/overrides/page-lorem-ipsum`

## Site chrome (header/footer)

Override pages should typically include:

- `SiteHeader`
- `SiteFooter`

This keeps the override page consistent with the rest of the public site.

## Notes

- Keep the override mapping explicit (no dynamic imports) so Vite includes the TSX pages at build time.
- Overrides are a last-resort tool—prefer normal modules and post-type templates when possible.


