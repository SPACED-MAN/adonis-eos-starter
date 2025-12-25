import Post from '#models/post'
import RevisionService from '#services/revision_service'
import PostSnapshotService from '#services/post_snapshot_service'
import PostSerializerService from '#services/post_serializer_service'

type ApproveReviewDraftParams = {
  postId: string
  userId: number
}

export default class ApproveReviewDraft {
  static async handle({ postId, userId }: ApproveReviewDraftParams): Promise<void> {
    // 1. Get the current Review snapshot
    const snapshot = await PostSerializerService.serialize(postId, 'review')

    // 2. Apply snapshot to Source
    await PostSnapshotService.apply(postId, snapshot, 'source')

    // 3. Clear review draft (JSON and shadow columns)
    await PostSnapshotService.clearDraft(postId, 'review')

    // 4. Record revision
    await RevisionService.recordActiveVersionsSnapshot({
      postId,
      mode: 'source',
      action: 'approve-review-to-source',
      userId,
    })

    // 5. Promote agent execution history
    try {
      const agentExecutionService = await import('#services/agent_execution_service')
      await agentExecutionService.default.promoteReviewToSource(postId)
    } catch (historyError: any) {
      console.error('Failed to promote agent execution history:', {
        postId,
        error: historyError?.message,
      })
    }
  }
}

