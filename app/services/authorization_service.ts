import type { RoleName } from '#types/role_types'
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

  static canCreatePost(role: UserRole, postType?: string): boolean {
    return roleRegistry.hasPermission(role, 'posts.create', postType)
  }

  static canDeletePosts(role: UserRole, postType?: string): boolean {
    return roleRegistry.hasPermission(role, 'posts.delete', postType)
  }

  static canPublishOrArchive(role: UserRole, postType?: string): boolean {
    return (
      roleRegistry.hasPermission(role, 'posts.publish', postType) ||
      roleRegistry.hasPermission(role, 'posts.archive', postType)
    )
  }

  static canPublish(role: UserRole, postType?: string): boolean {
    return roleRegistry.hasPermission(role, 'posts.publish', postType)
  }

  static canBulkAction(role: UserRole, action: BulkAction, postType?: string): boolean {
    if (action === 'delete') {
      return this.canDeletePosts(role, postType)
    }
    if (action === 'duplicate') {
      return roleRegistry.hasPermission(role, 'posts.edit', postType)
    }
    if (action === 'regeneratePermalinks') {
      return this.canPublishOrArchive(role, postType)
    }
    if (action === 'publish' || action === 'archive') {
      return this.canPublishOrArchive(role, postType)
    }
    if (action === 'draft') {
      return (
        roleRegistry.hasPermission(role, 'posts.edit', postType) ||
        roleRegistry.hasPermission(role, 'posts.create', postType)
      )
    }
    return false
  }

  static canUpdateStatus(role: UserRole, nextStatus?: string | null, postType?: string): boolean {
    if (!nextStatus) return true
    if (nextStatus === 'draft') return true
    return this.canPublishOrArchive(role, postType)
  }

  static canRevertRevision(role: UserRole, postType?: string): boolean {
    return roleRegistry.hasPermission(role, 'posts.revisions.manage', postType)
  }
}

const authorizationService = AuthorizationService
export default authorizationService
