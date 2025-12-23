import Post from '#models/post'
import RevisionService from '#services/revision_service'

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
    const draftPayload: Record<string, any> = {
      slug: payload.slug,
      title: payload.title,
      status: payload.status,
      excerpt: payload.excerpt,
      parentId: payload.parentId,
      orderIndex: payload.orderIndex,
      metaTitle: payload.metaTitle,
      metaDescription: payload.metaDescription,
      canonicalUrl: payload.canonicalUrl,
      robotsJson: payload.robotsJson,
      jsonldOverrides: payload.jsonldOverrides,
      featuredImageId: payload.featuredImageId,
      customFields: payload.customFields,
      modules: payload.modules,
      taxonomyTermIds: Array.isArray(payload.taxonomyTermIds)
        ? (payload.taxonomyTermIds as string[])
        : undefined,
      savedAt: new Date().toISOString(),
      savedBy: userEmail || (mode === 'ai-review' ? 'AI Agent' : null),
    }

    const updateField = mode === 'review' ? 'review_draft' : 'ai_review_draft'
    await Post.query()
      .where('id', postId)
      .update({ [updateField]: draftPayload } as any)

    // Capture version snapshot
    await RevisionService.recordActiveVersionsSnapshot({
      postId,
      mode,
      action: mode === 'review' ? 'save-review' : 'save-ai-review',
      userId,
    })
  }
}

