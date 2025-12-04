export const POST_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const
export type PostStatus = (typeof POST_STATUSES)[number]
