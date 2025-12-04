/**
 * Utility functions for checking user permissions on the frontend
 */

import { usePage } from '@inertiajs/react'

export type PermissionKey = string

/**
 * Hook to check if the current user has a specific permission
 */
export function useHasPermission(permission: PermissionKey): boolean {
  const page = usePage()
  const permissions = (page.props as any)?.permissions || []
  return permissions.includes(permission)
}

/**
 * Hook to get all permissions for the current user
 */
export function usePermissions(): PermissionKey[] {
  const page = usePage()
  return (page.props as any)?.permissions || []
}

/**
 * Check if a permission array includes a specific permission
 * Useful for direct permission checks without hooks
 */
export function hasPermission(permissions: PermissionKey[], permission: PermissionKey): boolean {
  return permissions.includes(permission)
}

