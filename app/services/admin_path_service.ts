/**
 * Admin Path Service
 *
 * Centralizes admin path prefix logic for URL obfuscation.
 * Allows changing admin URLs from /admin/* to a custom prefix (e.g., /blah/*)
 * via ADMIN_PATH_PREFIX environment variable.
 */

import env from '#start/env'

/**
 * Get the admin path prefix (default: 'admin')
 * Must be a valid URL segment (no slashes, no special chars)
 */
export function getAdminPathPrefix(): string {
  const prefix = env.get('ADMIN_PATH_PREFIX', 'admin')
  // Sanitize: remove slashes and ensure it's a valid path segment
  const sanitized = String(prefix || 'admin')
    .trim()
    .replace(/[\/\\]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
  return sanitized || 'admin' // fallback to 'admin' if empty after sanitization
}

/**
 * Build an admin URL path (e.g., '/admin/posts' or '/blah/posts')
 */
export function adminPath(path: string = ''): string {
  const prefix = getAdminPathPrefix()
  const cleanPath = String(path || '').trim().replace(/^\/+/, '') // remove leading slashes
  if (!cleanPath) return `/${prefix}`
  return `/${prefix}/${cleanPath}`
}

/**
 * Build an admin API URL path (e.g., '/api/posts' - API paths don't use admin prefix)
 * Note: API routes are already under /api, so this is mainly for consistency
 */
export function adminApiPath(path: string = ''): string {
  const cleanPath = String(path || '').trim().replace(/^\/+/, '') // remove leading slashes
  if (!cleanPath) return '/api'
  return `/api/${cleanPath}`
}

