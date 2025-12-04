import type { RoleName, PermissionKey } from '#types/role_types'
import roleRegistry from '#services/role_registry'

export type UserRole = RoleName | undefined

export type BulkAction =
  | 'publish'
  | 'draft'
  | 'archive'
  | 'delete'
  | 'duplicate'
  | 'regeneratePermalinks'

export class AuthorizationService {
  static isAdmin(role: UserRole): boolean {
    return role === 'admin'
  }

  static canCreatePost(role: UserRole): boolean {
    if (
      roleRegistry.hasPermission(role, 'posts.create') ||
      roleRegistry.hasPermission(role, 'posts.edit')
    ) {
      return true
    }
    // Fallback to legacy behavior if roles are not yet registered
    return role === 'admin' || role === 'editor'
  }

  static canDeletePosts(role: UserRole): boolean {
    if (roleRegistry.hasPermission(role, 'posts.delete')) {
      return true
    }
    return role === 'admin'
  }

  static canPublishOrArchive(role: UserRole): boolean {
    if (
      roleRegistry.hasPermission(role, 'posts.publish') ||
      roleRegistry.hasPermission(role, 'posts.archive')
    ) {
      return true
    }
    return role === 'admin' || role === 'editor'
  }

  static canBulkAction(role: UserRole, action: BulkAction): boolean {
    if (action === 'delete') {
      return this.canDeletePosts(role)
    }
    if (action === 'duplicate') {
      // Treat duplicate as "edit" permission
      if (roleRegistry.hasPermission(role, 'posts.edit')) {
        return true
      }
      return role === 'admin' || role === 'editor'
    }
    if (action === 'regeneratePermalinks') {
      // Treat permalink regen as publish/archive level
      return this.canPublishOrArchive(role)
    }
    if (action === 'publish' || action === 'archive') {
      return this.canPublishOrArchive(role)
    }
    if (action === 'draft') {
      // Anyone who can edit can draft
      if (
        roleRegistry.hasPermission(role, 'posts.edit') ||
        roleRegistry.hasPermission(role, 'posts.create')
      ) {
        return true
      }
      return role === 'admin' || role === 'editor' || role === 'translator'
    }
    return false
  }

  static canUpdateStatus(role: UserRole, nextStatus?: string | null): boolean {
    if (!nextStatus) return true
    if (nextStatus === 'draft') return true
    return this.canPublishOrArchive(role)
  }

  static canRevertRevision(role: UserRole): boolean {
    if (roleRegistry.hasPermission(role, 'posts.revisions.manage')) {
      return true
    }
    return role === 'admin' || role === 'editor'
  }
}

const authorizationService = AuthorizationService
export default authorizationService
