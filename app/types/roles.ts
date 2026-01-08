export const ROLES = [
	'admin',
	'editor_admin',
	'editor',
	'translator',
	'ai_agent',
	'workflow',
] as const
export type Role = (typeof ROLES)[number]
