import type { RoleDefinition } from '#types/role_types'

const editorRole: RoleDefinition = {
  name: 'editor',
  label: 'Editor',
  description:
    'Can create and edit content, media, menus, and forms, but cannot publish or approve content. Cannot change system settings or manage users.',
  permissions: [
    'admin.access',
    'admin.settings.view',
    // Content - Can edit but not publish or approve
    'posts.create',
    'posts.edit',
    'posts.archive',
    'posts.revisions.manage',
    'posts.export',
    'posts.review.save',
    // Note: AI Review saves are agent-only (see ai_agent role)
    // Media
    'media.view',
    'media.upload',
    'media.replace',
    'media.variants.generate',
    'media.optimize',
    // Menus
    'menus.view',
    'menus.edit',
    // Forms
    'forms.view',
    'forms.edit',
    'forms.submissions.export',
    // Globals
    'globals.view',
    'globals.edit',
    // Agents
    'agents.view',
    // Profiles
    'profiles.view',
    'profiles.edit',
  ],
  postTypePermissions: {
    documentation: [], // documentation is admin-only
  },
}

export default editorRole
