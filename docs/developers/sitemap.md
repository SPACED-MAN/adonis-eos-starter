# XML Sitemap (Backend + Admin UI)

## Overview
- Public endpoint: `GET /sitemap.xml` (cached 5 minutes, Cache-Control public).
- Source: published posts only; `robotsJson.index === false` entries are excluded.
- URL building: uses default URL pattern per post type/locale (with `{path}` for hierarchy) via `url_pattern_service`.
- Ordering: respects hierarchy and `order_index` when emitting URLs (parent-first).
- Canonical: prefers `canonical_url` if present; otherwise builds absolute URL from host + pattern.
- Lastmod: uses `updated_at` or `published_at` (fallback to `created_at`).

## Admin controls
- Page: `Admin → Settings → SEO`.
  - Shows sitemap URL and last generated time.
  - “Rebuild sitemap” clears cache and regenerates.
- API (admin only):
  - `GET /api/seo/sitemap/status`
  - `POST /api/seo/sitemap/rebuild`

## Service notes
- File: `app/services/sitemap_service.ts`.
- Cache TTL: 5 minutes per host/protocol; `clearCache()` to invalidate.
- Uses `post_type_config_service` to decide hierarchy (`hierarchyEnabled`) and patterns; falls back to `/{type}/{slug}` (or `{path}`) when none found.
- Uses `locale_service` default locale to choose fallback pattern prefix.

## Extending
- To add gzip: wrap response in gzip and adjust `Content-Encoding`.
- To shard (50k+ URLs): add sitemap index and chunked generation in `sitemap_service`.
- To add `<xhtml:link>` alternates: extend service to fetch sibling locales and emit alternates per URL.
- To include taxonomies/static pages: add providers that append URLs before serialization.

