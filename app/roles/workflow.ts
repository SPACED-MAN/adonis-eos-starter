import type { RoleDefinition } from '#types/role_types'

/**
 * Workflow Role
 *
 * Special role for automated workflows (e.g. n8n).
 * Used for attribution when content is created or modified by an automated process.
 *
 * Key characteristics:
 * - Can create and edit content
 * - Cannot login via the web interface
 * - Typically restricted to API operations
 */
const workflowRole: RoleDefinition = {
	name: 'workflow',
	label: 'Workflow',
	description: 'System role for automated workflows and integrations.',
	permissions: [
		'posts.create',
		'posts.edit',
		'posts.view',
		'posts.export',
		'media.view',
	],
}

export default workflowRole



