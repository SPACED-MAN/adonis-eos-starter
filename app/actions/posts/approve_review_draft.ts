import Post from '#models/post'
import RevisionService from '#services/revision_service'
import UpdatePost from '#actions/posts/update_post'
import UpsertPostCustomFields from '#actions/posts/upsert_post_custom_fields'
import ApplyPostTaxonomyAssignments from '#actions/posts/apply_post_taxonomy_assignments'
import PromotePostModules from '#actions/posts/promote_post_modules'

type ApproveReviewDraftParams = {
  postId: string
  userId: number
}

export default class ApproveReviewDraft {
  static async handle({ postId, userId }: ApproveReviewDraftParams): Promise<void> {
    const current = await Post.findOrFail(postId)
    const rd: any = current.reviewDraft

    // 1. Promote basic fields using UpdatePost action (only if reviewDraft exists)
    if (rd) {
      await UpdatePost.handle({
        postId,
        slug: rd.slug ?? current.slug,
        title: rd.title ?? current.title,
        status: current.status, // preserve status
        excerpt: rd.excerpt ?? current.excerpt,
        parentId: rd.parentId ?? current.parentId ?? undefined,
        orderIndex: rd.orderIndex ?? (current as any).orderIndex ?? 0,
        metaTitle: rd.metaTitle ?? current.metaTitle,
        metaDescription: rd.metaDescription ?? current.metaDescription,
        canonicalUrl: rd.canonicalUrl ?? current.canonicalUrl,
        robotsJson: this.parseJsonField(rd.robotsJson) ?? current.robotsJson,
        jsonldOverrides: this.parseJsonField(rd.jsonldOverrides) ?? current.jsonldOverrides,
        featuredImageId:
          rd.featuredImageId !== undefined
            ? rd.featuredImageId === null || rd.featuredImageId === ''
              ? null
              : rd.featuredImageId
            : current.featuredImageId,
      })

      // 2. Promote custom fields
      if (Array.isArray(rd.customFields)) {
        await UpsertPostCustomFields.handle({
          postId,
          customFields: rd.customFields,
        })
      }
    }

    // 3. Promote module changes
    // PromotePostModules.handle will handle both rd.modules (atomic draft) 
    // AND the fallback DB columns (review_props/overrides/added/deleted)
    await PromotePostModules.handle({
      postId,
      draftModules: rd?.modules,
    })

    // 4. Promote taxonomy term assignments (only if in reviewDraft)
    if (rd && Array.isArray(rd.taxonomyTermIds)) {
      await ApplyPostTaxonomyAssignments.handle({
        postId,
        postType: current.type,
        termIds: (rd.taxonomyTermIds as any[]).map((x) => String(x)),
      })
    }

    // 5. Clear review draft
    await Post.query()
      .where('id', postId)
      .update({ review_draft: null } as any)

    // 6. Record revision
    await RevisionService.recordActiveVersionsSnapshot({
      postId,
      mode: 'source',
      action: 'approve-review-to-source',
      userId,
    })

    // 7. Promote agent execution history
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

  private static parseJsonField(val: any): Record<string, any> | null | undefined {
    if (val === undefined) return undefined
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return null
      }
    }
    return val
  }
}

