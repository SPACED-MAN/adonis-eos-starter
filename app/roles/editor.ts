import type { RoleDefinition } from '#types/role_types'

const editorRole: RoleDefinition = {
	name: 'editor',
	label: 'Editor',
	description:
		'Can create and edit content, media, menus, and forms, but cannot change system settings or manage users.',
	permissions: [
		'admin.access',
		'admin.settings.view',
		// Content
		'posts.create',
		'posts.edit',
		'posts.publish',
		'posts.archive',
		'posts.revisions.manage',
		'posts.export',
		'posts.review.save',
		'posts.review.approve',
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
}

export default editorRole


