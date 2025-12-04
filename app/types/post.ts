export const POST_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const VIEW_MODES = ['approved', 'review', 'ai-review'] as const
export type ViewMode = (typeof VIEW_MODES)[number]
