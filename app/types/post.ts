export const POST_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

/**
 * Active Versions (aka "Mode" in older UI terminology)
 *
 * - source: canonical content (what used to be called "approved")
 * - review: human review draft
 * - ai-review: agent staging area
 */
export const ACTIVE_VERSIONS = ['source', 'review', 'ai-review'] as const
export type ActiveVersion = (typeof ACTIVE_VERSIONS)[number]

export function normalizeActiveVersion(input: unknown): ActiveVersion {
  const v = String(input || '').trim().toLowerCase()
  if (v === 'approved') return 'source'
  if (v === 'review') return 'review'
  if (v === 'ai-review' || v === 'ai_review') return 'ai-review'
  return 'source'
}
