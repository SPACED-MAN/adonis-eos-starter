import type { RoleDefinition } from '#types/role_types'

const translatorRole: RoleDefinition = {
	name: 'translator',
	label: 'Translator',
	description:
		'Can access the admin UI to translate content, but cannot publish or change global settings.',
	permissions: [
		'admin.access',
		'admin.settings.view',
		// Content (edit but not publish/delete)
		'posts.edit',
		'posts.revisions.manage',
		'posts.review.save', // Can submit for review
		// Media (view only)
		'media.view',
		// Menus (view only)
		'menus.view',
		// Forms (view only)
		'forms.view',
		// Globals (view only)
		'globals.view',
		// Profiles (view only)
		'profiles.view',
	],
}

export default translatorRole


