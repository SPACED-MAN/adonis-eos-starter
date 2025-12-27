import RevisionService from '#services/revision_service'
import PostSnapshotService from '#services/post_snapshot_service'

type SaveReviewDraftParams = {
  postId: string
  payload: Record<string, any>
  userId: number
  userEmail: string | null
  mode: 'review' | 'ai-review'
}

export default class SaveReviewDraft {
  static async handle({
    postId,
    payload,
    userId,
    userEmail,
    mode,
  }: SaveReviewDraftParams): Promise<void> {
    // 1. Create a canonical snapshot from the payload
    const snapshot = PostSnapshotService.fromPayload(payload)

    // 2. Add extra metadata for the draft
    if (snapshot.post) {
      ;(snapshot.post as any).savedBy = userEmail || (mode === 'ai-review' ? 'AI Agent' : 'User')
      ;(snapshot.post as any).savedAt = new Date().toISOString()
    }

    // 3. Apply the snapshot using the centralized service
    // This handles BOTH the JSON column and the granular database columns.
    await PostSnapshotService.apply(postId, snapshot, mode)

    // 4. Record revision (captures the snapshot we just applied)
    await RevisionService.recordActiveVersionsSnapshot({
      postId,
      mode,
      action: mode === 'review' ? 'save-review' : 'save-ai-review',
      userId,
    })
  }
}
