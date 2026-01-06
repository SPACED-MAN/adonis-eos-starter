/**
 * Admin Path Utility for Inertia Components
 *
 * Helper function to build admin paths in React components.
 * Uses the adminPathPrefix shared prop from Inertia.
 */

import { usePage } from '@inertiajs/react'

/**
 * Get admin path prefix from Inertia shared props
 */
export function useAdminPathPrefix(): string {
  try {
    const page = usePage()
    const prefix = (page.props as any)?.adminPathPrefix as string | undefined
    return prefix || 'admin' // fallback to 'admin'
  } catch (e) {
    if (typeof window !== 'undefined') {
      return (window as any).Inertia?.page?.props?.adminPathPrefix || 
             (window as any).__INITIAL_PROPS__?.adminPathPrefix || 'admin'
    }
    return 'admin'
  }
}

/**
 * Pure function to build admin URL paths
 */
export function buildAdminPath(prefix: string, path: string = ''): string {
  const cleanPath = String(path || '')
    .trim()
    .replace(/^\/+/, '') // remove leading slashes
  if (!cleanPath) return `/${prefix}`
  return `/${prefix}/${cleanPath}`
}

/**
 * Hook that returns a function to build admin URL paths (e.g., '/admin/posts' or '/blah/posts')
 * Must be called inside a React component (uses hook)
 *
 * Usage:
 *   const adminPath = useAdminPath()
 *   const logoutUrl = adminPath('logout')
 *   const dashboardUrl = adminPath()
 */
export function useAdminPath(): (path?: string) => string {
  const prefix = useAdminPathPrefix()
  return (path: string = '') => buildAdminPath(prefix, path)
}
