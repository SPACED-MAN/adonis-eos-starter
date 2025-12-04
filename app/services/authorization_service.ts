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
    return (
      roleRegistry.hasPermission(role, 'posts.create') ||
      roleRegistry.hasPermission(role, 'posts.edit')
    )
  }

  static canDeletePosts(role: UserRole): boolean {
    return roleRegistry.hasPermission(role, 'posts.delete')
  }

  static canPublishOrArchive(role: UserRole): boolean {
    return (
      roleRegistry.hasPermission(role, 'posts.publish') ||
      roleRegistry.hasPermission(role, 'posts.archive')
    )
  }

  static canPublish(role: UserRole): boolean {
    return roleRegistry.hasPermission(role, 'posts.publish')
  }

  static canBulkAction(role: UserRole, action: BulkAction): boolean {
    if (action === 'delete') {
      return this.canDeletePosts(role)
    }
    if (action === 'duplicate') {
      return roleRegistry.hasPermission(role, 'posts.edit')
    }
    if (action === 'regeneratePermalinks') {
      return this.canPublishOrArchive(role)
    }
    if (action === 'publish' || action === 'archive') {
      return this.canPublishOrArchive(role)
    }
    if (action === 'draft') {
      return (
        roleRegistry.hasPermission(role, 'posts.edit') ||
        roleRegistry.hasPermission(role, 'posts.create')
      )
    }
    return false
  }

  static canUpdateStatus(role: UserRole, nextStatus?: string | null): boolean {
    if (!nextStatus) return true
    if (nextStatus === 'draft') return true
    return this.canPublishOrArchive(role)
  }

  static canRevertRevision(role: UserRole): boolean {
    return roleRegistry.hasPermission(role, 'posts.revisions.manage')
  }
}

const authorizationService = AuthorizationService
export default authorizationService
