# SEO, Routing & Analytics

Configure SEO settings, URL patterns, redirects, and track user engagement with native analytics.

## Overview

Adonis EOS provides comprehensive SEO, routing, and native analytics features:

- **URL Patterns**: Custom URL structures per post type and locale.
- **Redirects**: 301/302 redirects for moved content.
- **SEO Meta Tags**: Automatic generation of meta tags, Open Graph, Twitter Cards.
- **Structured Data**: JSON-LD for rich search results.
- **Native Analytics**: Privacy-focused, high-performance tracking for views and clicks.
- **Interaction Heatmaps**: Visual overlays of user click data.
- **XML Sitemap**: Automatic generation of search engine sitemaps.

---

## Native Analytics & Heatmaps

Adonis EOS includes a built-in analytics engine designed for high performance and minimal client-side impact.

### Technical Implementation

- **Tracking Utility**: A lightweight JavaScript utility (`inertia/site/utils/analytics.ts`) tracks page views and clicks.
- **Performance**:
    - Uses the **Beacon API** (`navigator.sendBeacon`) for non-blocking data transmission.
    - Falls back to `fetch` with `keepalive: true` when `sendBeacon` is unavailable.
    - **Event Batching**: Click events are batched (default: 5 events or every 10 seconds) to reduce network requests.
- **Exclusion Logic**: Authenticated administrative users (admin, editor, translator) are automatically excluded from tracking to ensure data accuracy.
- **SPA Integration**: Listens to Inertia.js router events (`router.on('success')`) to accurately track page views in a Single Page Application environment.

### Data Storage

Analytics events are stored in the `analytics_events` table:
- `event_type`: 'view' or 'click'.
- `post_id`: Associated content ID (nullable for global events).
- `x`, `y`: Coordinates for click events (relative to document).
- `viewport_width`: Captured to help normalize heatmap data.
- `metadata`: JSONB field for additional context (e.g., URL path, CSS selector of clicked element).

### Heatmap Visualization

Heatmaps are rendered in the admin panel using a canvas overlay:
1. The target post is loaded in an iframe.
2. Interaction data (x/y coordinates) is fetched for that specific post.
3. A transparent canvas is layered over the iframe, and a radial gradient is drawn for each interaction point to create the "heatmap" effect.

---

## URL Patterns

Define custom URL structures for different post types:

```
/blog/{slug}
/{locale}/blog/{yyyy}/{slug}
/docs/{slug}
```

Patterns support variables:

- `{slug}` - Post slug
- `{locale}` - Language code
- `{yyyy}` - Year
- `{mm}` - Month
- `{dd}` - Day
- `{path}` - Full hierarchical path

## Redirects

Automatically created when:

- Post slugs change
- URL patterns are updated

Manually created for:

- Retired pages
- External redirects
- Campaign URLs

## SEO Best Practices

1. **Unique Titles**: Each page should have a unique meta title
2. **Descriptions**: Write compelling meta descriptions (150-160 chars)
3. **Canonical URLs**: Use canonical tags to prevent duplicate content
4. **Alt Text**: Add descriptive alt text to all images
5. **Structured Data**: Enable JSON-LD for rich snippets
6. **Mobile-Friendly**: All content is responsive by default

## Configuration

SEO settings can be configured at:

- **Global Level**: Site-wide defaults in Site Settings
- **Post Type Level**: Post type-specific URL patterns
- **Post Level**: Per-post SEO overrides

## Admin Tools

Access SEO tools from the Admin panel:

- `/admin/settings/url-patterns` - Configure URL patterns
- `/admin/settings/redirects` - Manage redirects
- Post Editor → SEO Settings - Per-post SEO

## XML Sitemap

### Overview

- Public endpoint: `GET /sitemap.xml` (cached ~5 minutes, Cache-Control public).
- Source: published posts only; `robotsJson.index === false` entries are excluded.
- URL building: uses default URL pattern per post type/locale (with `{path}` for hierarchy) via `url_pattern_service`.
- Ordering: respects hierarchy and `order_index` when emitting URLs (parent-first).
- Canonical: prefers `canonical_url` if present; otherwise builds absolute URL from host + pattern.
- Lastmod: uses `updated_at` or `published_at` (fallback to `created_at`).

### Admin controls

- Page: `Admin → Settings → SEO`
  - shows sitemap URL and last generated time
  - “Rebuild sitemap” clears cache and regenerates
- API (admin only):
  - `GET /api/seo/sitemap/status`
  - `POST /api/seo/sitemap/rebuild`

### Service notes

- File: `app/services/sitemap_service.ts`.
- Cache TTL: ~5 minutes per host/protocol; `clearCache()` to invalidate.
- Uses `post_type_config_service` to decide hierarchy (`hierarchyEnabled`) and patterns; falls back to `/{type}/{slug}` (or `{path}`) when none found.
- Uses `locale_service` default locale to choose fallback pattern prefix.

## Next Steps

Learn more about internationalization and how to manage multi-language content with proper hreflang implementation.
