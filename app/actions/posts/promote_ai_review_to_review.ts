import RevisionService from '#services/revision_service'
import PostSnapshotService from '#services/post_snapshot_service'
import PostSerializerService from '#services/post_serializer_service'
import Post from '#models/post'

type PromoteAiReviewToReviewParams = {
  postId: string
  userId: number
  userEmail?: string | null
}

/**
 * Action to promote an AI Review draft into a standard Review draft.
 * This moves post-level fields and all module-level staging (props/overrides/added/deleted).
 */
export default class PromoteAiReviewToReview {
  static async handle({ postId, userId }: PromoteAiReviewToReviewParams): Promise<void> {
    // 1. Get the current AI Review snapshot
    // We bypass the atomic draft to ensure we get the latest granular changes from the database
    const snapshot = await PostSerializerService.serialize(postId, 'ai-review', {
      bypassAtomicDraft: true,
    })

    // 2. Apply snapshot to Review mode
    await PostSnapshotService.apply(postId, snapshot, 'review')

    // 3. Clear AI Review draft (JSON and shadow columns)
    await PostSnapshotService.clearDraft(postId, 'ai-review')

    // 4. Record revision
    await RevisionService.recordActiveVersionsSnapshot({
      postId,
      mode: 'review',
      action: 'promote-ai-review-to-review',
      userId,
    })

    // 5. Promote execution history
    try {
      const agentExecutionService = (await import('#services/agent_execution_service')).default
      await agentExecutionService.promoteAiReviewToReview(postId)
    } catch (e) {
      console.error('Failed to promote agent history during AI Review approval:', e)
    }
  }
}

