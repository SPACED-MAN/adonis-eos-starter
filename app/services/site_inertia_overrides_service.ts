/**
 * Site Inertia Overrides
 *
 * Allows specific postType+slug combinations to render a dedicated Inertia page component
 * (a "static override") instead of the generic `site/post` page.
 *
 * This is intended for rare, one-off experiences (campaign pages, complex layouts, etc.)
 * while still letting the content exist as a normal Post in the CMS.
 */

/**
 * Return an Inertia page component name (e.g. "site/overrides/page-lorem-ipsum") for a given post,
 * or null if no override exists.
 *
 * IMPORTANT: Keep this mapping explicit so Vite can statically include the TSX pages.
 */
export function getSiteInertiaOverrideForPost(postType: string, slug: string): string | null {
  const key = `${String(postType || '').trim()}:${String(slug || '').trim()}`

  const overrides: Record<string, string> = {
    // Example one-off static override page (page post type, slug: lorem-ipsum)
    'page:lorem-ipsum': 'site/overrides/page-lorem-ipsum',
  }

  return overrides[key] || null
}
