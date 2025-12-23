import type { RoleDefinition } from '#types/role_types'

const adminRole: RoleDefinition = {
  name: 'admin',
  label: 'Administrator',
  description: 'Full access to all admin features, content, and settings.',
  permissions: [
    'admin.access',
    'admin.users.manage',
    'admin.roles.manage',
    'admin.settings.view',
    'admin.settings.update',
    'admin.database.export',
    'admin.database.import',
    // Content
    'posts.create',
    'posts.edit',
    'posts.publish',
    'posts.archive',
    'posts.delete',
    'posts.revisions.manage',
    'posts.export',
    'posts.review.save',
    'posts.review.approve',
    'posts.ai-review.approve',
    // Media
    'media.view',
    'media.upload',
    'media.replace',
    'media.delete',
    'media.variants.generate',
    'media.optimize',
    // Menus
    'menus.view',
    'menus.edit',
    'menus.delete',
    // Taxonomies
    'taxonomies.view',
    'taxonomies.edit',
    'taxonomies.delete',
    // Forms
    'forms.view',
    'forms.edit',
    'forms.delete',
    'forms.submissions.export',
    // Globals
    'globals.view',
    'globals.edit',
    'globals.delete',
    // Agents
    'agents.view',
    'agents.dropdown',
    'agents.global',
    'agents.field',
    'agents.edit',
    // Workflows
    'workflows.view',
    'workflows.trigger',
    // Profiles
    'profiles.view',
    'profiles.edit',
  ],
}

export default adminRole
