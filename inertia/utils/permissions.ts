/**
 * Utility functions for checking user permissions on the frontend
 */

import { usePage } from '@inertiajs/react'

export type PermissionKey = string

/**
 * Hook to check if the current user has a specific permission
 */
export function useHasPermission(permission: PermissionKey): boolean {
  try {
    const page = usePage()
    const permissions = (page.props as any)?.permissions || []
    return permissions.includes(permission)
  } catch (e) {
    // If used outside of Inertia context (e.g. SiteAdminBar), return false or try to get from window
    if (typeof window !== 'undefined') {
      const permissions = (window as any).Inertia?.page?.props?.permissions || 
                          (window as any).__INITIAL_PROPS__?.permissions || []
      return permissions.includes(permission)
    }
    return false
  }
}

/**
 * Hook to get all permissions for the current user
 */
export function usePermissions(): PermissionKey[] {
  try {
    const page = usePage()
    return (page.props as any)?.permissions || []
  } catch (e) {
    if (typeof window !== 'undefined') {
      return (window as any).Inertia?.page?.props?.permissions || 
             (window as any).__INITIAL_PROPS__?.permissions || []
    }
    return []
  }
}

/**
 * Check if a permission array includes a specific permission
 * Useful for direct permission checks without hooks
 */
export function hasPermission(permissions: PermissionKey[], permission: PermissionKey): boolean {
  return permissions.includes(permission)
}
