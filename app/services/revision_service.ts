import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

export type RevisionMode = 'approved' | 'review' | 'ai-review'
export type ActiveVersion = 'source' | 'review' | 'ai-review'

type RecordRevisionParams = {
  postId: string
  mode: RevisionMode | ActiveVersion
  snapshot: Record<string, any>
  userId?: number | null
}

type RecordActiveVersionsSnapshotParams = {
  postId: string
  /**
   * Used only for the revision "mode" column.
   * - source maps to approved
   */
  mode: RevisionMode | ActiveVersion
  /**
   * Human-readable action label for the snapshot.
   * Example: save-review | approve-review | reject-ai-review
   */
  action: string
  userId?: number | null
}

export default class RevisionService {
  static async buildActiveVersionsSnapshot(postId: string, action: string) {
    const post = await db
      .from('posts')
      .where('id', postId)
      .select(
        'id',
        'type',
        'locale',
        'slug',
        'title',
        'status',
        'excerpt',
        'parent_id as parentId',
        'order_index as orderIndex',
        'meta_title as metaTitle',
        'meta_description as metaDescription',
        'canonical_url as canonicalUrl',
        'robots_json as robotsJson',
        'jsonld_overrides as jsonldOverrides',
        'featured_image_id as featuredImageId',
        'review_draft as reviewDraft',
        'ai_review_draft as aiReviewDraft'
      )
      .first()

    const modules = await db
      .from('post_modules')
      .join('module_instances', 'post_modules.module_id', 'module_instances.id')
      .where('post_modules.post_id', postId)
      .select(
        'post_modules.id as postModuleId',
        'post_modules.order_index as orderIndex',
        'post_modules.admin_label as adminLabel',
        'post_modules.locked as locked',
        'post_modules.review_added as reviewAdded',
        'post_modules.review_deleted as reviewDeleted',
        'post_modules.ai_review_added as aiReviewAdded',
        'post_modules.ai_review_deleted as aiReviewDeleted',
        'post_modules.overrides as overrides',
        'post_modules.review_overrides as reviewOverrides',
        'post_modules.ai_review_overrides as aiReviewOverrides',
        'module_instances.id as moduleInstanceId',
        'module_instances.type as type',
        'module_instances.scope as scope',
        'module_instances.global_slug as globalSlug',
        'module_instances.global_label as globalLabel',
        'module_instances.props as props',
        'module_instances.review_props as reviewProps',
        'module_instances.ai_review_props as aiReviewProps'
      )
      .orderBy('post_modules.order_index', 'asc')

    const customFields = await db
      .from('post_custom_field_values')
      .where('post_id', postId)
      .select('field_slug as fieldSlug', 'value')

    // Note: Lucid/Knex dialect in this project doesn't support `.pluck()` on the query builder.
    const taxonomyRows = await db
      .from('post_taxonomy_terms')
      .where('post_id', postId)
      .select('taxonomy_term_id as taxonomyTermId')
    const taxonomyTermIds = (taxonomyRows || []).map((r: any) => String(r.taxonomyTermId))

    return {
      kind: 'active-versions',
      action,
      capturedAt: new Date().toISOString(),
      post: post
        ? {
            id: post.id,
            type: post.type,
            locale: post.locale,
            slug: post.slug,
            title: post.title,
            status: post.status,
            excerpt: post.excerpt ?? null,
            parentId: post.parentId ?? null,
            orderIndex: post.orderIndex ?? 0,
            metaTitle: post.metaTitle ?? null,
            metaDescription: post.metaDescription ?? null,
            canonicalUrl: post.canonicalUrl ?? null,
            robotsJson: post.robotsJson ?? null,
            jsonldOverrides: post.jsonldOverrides ?? null,
            featuredImageId: post.featuredImageId ?? null,
            customFields: (customFields || []).map((r: any) => ({
              fieldSlug: String(r.fieldSlug),
              value: r.value ?? null,
            })),
            taxonomyTermIds,
          }
        : null,
      drafts: {
        reviewDraft: post?.reviewDraft ?? null,
        aiReviewDraft: post?.aiReviewDraft ?? null,
      },
      modules: (modules || []).map((m: any) => ({
        postModuleId: m.postModuleId,
        moduleInstanceId: m.moduleInstanceId,
        type: m.type,
        scope: m.scope,
        globalSlug: m.globalSlug ?? null,
        globalLabel: m.globalLabel ?? null,
        adminLabel: m.adminLabel ?? null,
        orderIndex: m.orderIndex ?? 0,
        locked: !!m.locked,
        flags: {
          reviewAdded: !!m.reviewAdded,
          reviewDeleted: !!m.reviewDeleted,
          aiReviewAdded: !!m.aiReviewAdded,
          aiReviewDeleted: !!m.aiReviewDeleted,
        },
        props: m.props ?? null,
        reviewProps: m.reviewProps ?? null,
        aiReviewProps: m.aiReviewProps ?? null,
        overrides: m.overrides ?? null,
        reviewOverrides: m.reviewOverrides ?? null,
        aiReviewOverrides: m.aiReviewOverrides ?? null,
      })),
    }
  }

  static async recordActiveVersionsSnapshot({
    postId,
    mode,
    action,
    userId,
  }: RecordActiveVersionsSnapshotParams): Promise<void> {
    const snapshot = await this.buildActiveVersionsSnapshot(postId, action)
    await this.record({
      postId,
      mode,
      snapshot,
      userId: userId ?? null,
    })
  }

  /**
   * Record a revision snapshot and prune older ones based on CMS_REVISIONS_LIMIT.
   */
  static async record({ postId, mode, snapshot, userId }: RecordRevisionParams): Promise<void> {
    // Map Source -> approved for storage.
    const dbMode: RevisionMode = mode === 'source' ? 'approved' : (mode as RevisionMode)
    const now = new Date()
    await db.table('post_revisions').insert({
      post_id: postId,
      user_id: userId ?? null,
      mode: dbMode,
      snapshot,
      created_at: now,
    })

    const limit = Number((env.get('CMS_REVISIONS_LIMIT') as any) ?? 20)
    if (limit > 0) {
      const oldRows = await db
        .from('post_revisions')
        .where('post_id', postId)
        .orderBy('created_at', 'desc')
        .offset(limit)
        .select('id')

      if (oldRows.length > 0) {
        await db
          .from('post_revisions')
          .whereIn(
            'id',
            oldRows.map((r: any) => r.id)
          )
          .delete()
      }
    }
  }
}
