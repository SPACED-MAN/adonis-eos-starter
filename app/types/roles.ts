export const ROLES = ['admin', 'editor_admin', 'editor', 'translator'] as const
export type Role = (typeof ROLES)[number]
