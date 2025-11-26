export const ROLES = ['admin', 'editor', 'translator'] as const
export type Role = typeof ROLES[number]


