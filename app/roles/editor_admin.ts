import type { RoleDefinition } from '#types/role_types'

const editorAdminRole: RoleDefinition = {
	name: 'editor_admin',
	label: 'Editor Admin',
	description:
		'Senior editor with full content management capabilities. Can publish posts, approve reviews, and manage all content, media, menus, and forms. Cannot manage users or system settings.',
	permissions: [
		'admin.access',
		'admin.settings.view',
		// Content - Full permissions including publish and approve
		'posts.create',
		'posts.edit',
		'posts.publish', // Can publish (unlike regular editor)
		'posts.archive',
		'posts.delete',
		'posts.revisions.manage',
		'posts.export',
		'posts.review.save',
		'posts.review.approve', // Can approve reviews (unlike regular editor)
		'posts.ai-review.save',
		'posts.ai-review.approve', // Can approve AI reviews (unlike regular editor)
		// Media - Full permissions
		'media.view',
		'media.upload',
		'media.replace',
		'media.delete',
		'media.variants.generate',
		'media.optimize',
		// Menus - Full permissions
		'menus.view',
		'menus.edit',
		'menus.delete',
		// Forms - Full permissions
		'forms.view',
		'forms.edit',
		'forms.delete',
		'forms.submissions.export',
		// Globals - Full permissions
		'globals.view',
		'globals.edit',
		'globals.delete',
		// Agents - Full permissions
		'agents.view',
		'agents.edit',
		// Profiles
		'profiles.view',
		'profiles.edit',
	],
}

export default editorAdminRole
