/**
 * Role and permission types for admin RBAC
 */

export type RoleName = 'admin' | 'editor' | 'translator' | string

/**
 * High-level permission buckets, used by controllers and services.
 *
 * We keep these coarse-grained to avoid overfitting to implementation details.
 */
export type PermissionKey =
  // Site-level/admin shell
  | 'admin.access'
  | 'admin.users.manage'
  | 'admin.roles.manage'
  | 'admin.settings.view'
  | 'admin.settings.update'
  // Content / posts
  | 'posts.create'
  | 'posts.edit'
  | 'posts.publish'
  | 'posts.archive'
  | 'posts.delete'
  | 'posts.revisions.manage'
  | 'posts.export'
  | 'posts.review.save'
  | 'posts.review.approve'
  | 'posts.ai-review.save'
  | 'posts.ai-review.approve'
  // Media
  | 'media.view'
  | 'media.upload'
  | 'media.replace'
  | 'media.delete'
  | 'media.variants.generate'
  | 'media.optimize'
  // Menus & navigation
  | 'menus.view'
  | 'menus.edit'
  | 'menus.delete'
  // Forms
  | 'forms.view'
  | 'forms.edit'
  | 'forms.delete'
  | 'forms.submissions.export'
  // Global modules / design system
  | 'globals.view'
  | 'globals.edit'
  | 'globals.delete'
  // Agents / AI helpers
  | 'agents.view'
  | 'agents.edit'
  // Profiles
  | 'profiles.view'
  | 'profiles.edit'

export interface RoleDefinition {
  /**
   * Stable role name persisted in DB (`users.role`)
   */
  name: RoleName

  /**
   * Human-friendly label for admin UI
   */
  label: string

  /**
   * Optional description for tooltips/help
   */
  description?: string

  /**
   * Set of permissions granted to this role
   */
  permissions: PermissionKey[]
}


