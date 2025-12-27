import CreatePost from '#actions/posts/create_post'
import UpdatePost from '#actions/posts/update_post'
import AddModuleToPost from '#actions/posts/add_module_to_post'
import Post from '#models/post'
import PostModule from '#models/post_module'
import ModuleInstance from '#models/module_instance'
import PostCustomFieldValue from '#models/post_custom_field_value'
import db from '@adonisjs/lucid/services/db'
import { coerceJsonObject } from '../helpers/jsonb.js'

type CanonicalModule = {
  postModuleId: string // Unique ID for updating this module instance on the post
  moduleInstanceId: string // The underlying instance ID
  type: string
  scope: 'local' | 'global' | 'post'
  orderIndex: number
  locked?: boolean
  props?: Record<string, any> | null
  overrides?: Record<string, any> | null
  globalSlug?: string | null
  adminLabel?: string | null
}

export type CanonicalPost = {
  metadata: {
    version: string
    exportedAt: string
  }
  post: {
    id: string
    type: string
    locale: string
    slug: string
    title: string
    status: 'draft' | 'scheduled' | 'published' | 'archived'
    excerpt?: string | null
    metaTitle?: string | null
    metaDescription?: string | null
    canonicalUrl?: string | null
    robotsJson?: Record<string, any> | null
    jsonldOverrides?: Record<string, any> | null
    socialTitle?: string | null
    socialDescription?: string | null
    socialImageId?: string | null
    noindex?: boolean
    nofollow?: boolean
    featuredImageId?: string | null
    customFields?: Array<{ slug: string; value: any }>
    taxonomyTermIds?: string[]
  }
  modules: CanonicalModule[]
  translations?: Array<{ id: string; locale: string }>
}

export default class PostSerializerService {
  private static readonly VERSION = '2.0.0'
  /**
   * Serialize a post based on view mode (source/review/ai-review) and its modules into a canonical JSON object.
   * @param postId - Post ID
   * @param mode - View mode: 'source' (approved), 'review' (review_draft), or 'ai-review' (ai_review_draft)
   */
  static async serialize(
    postId: string,
    mode: 'source' | 'review' | 'ai-review' = 'source',
    options: { bypassAtomicDraft?: boolean } = {}
  ): Promise<CanonicalPost> {
    const post = await Post.query().where('id', postId).first()
    if (!post) {
      throw new Error('Post not found')
    }
    // Load modules with their instances, including review/ai-review props
    const moduleRows = await db
      .from('post_modules')
      .join('module_instances', 'post_modules.module_id', 'module_instances.id')
      .where('post_modules.post_id', postId)
      .select(
        'post_modules.id as postModuleId',
        'post_modules.order_index as orderIndex',
        'post_modules.overrides',
        'post_modules.locked',
        'post_modules.admin_label',
        'module_instances.id as moduleInstanceId',
        'module_instances.type',
        'module_instances.scope',
        'module_instances.props',
        'module_instances.review_props',
        'module_instances.ai_review_props',
        'module_instances.global_slug as globalSlug'
      )
      .orderBy('post_modules.order_index', 'asc')

    // Family translations list
    const baseId = (post as any).translationOfId || post.id
    const family = await Post.query()
      .where((q) => {
        q.where('translationOfId', baseId).orWhere('id', baseId)
      })
      .select('id', 'locale')

    // Custom fields (slug:value) by slug from values table
    // Note: Custom fields in drafts are stored in the draft JSON, not in the separate table
    let customFields: Array<{ slug: string; value: any }> = []
    if (mode === 'review') {
      const reviewDraft = (post as any).reviewDraft || (post as any).review_draft
      if (
        reviewDraft &&
        typeof reviewDraft === 'object' &&
        Array.isArray(reviewDraft.customFields)
      ) {
        customFields = reviewDraft.customFields.map((cf: any) => ({
          slug: cf.slug,
          value: cf.value,
        }))
      } else {
        // Fall back to database values
        const cfVals = await PostCustomFieldValue.query()
          .where('postId', postId)
          .select('field_slug as slug', 'value')
        customFields = (cfVals || []).map((r: any) => ({ slug: r.slug, value: r.value }))
      }
    } else if (mode === 'ai-review') {
      const aiReviewDraft = (post as any).aiReviewDraft || (post as any).ai_review_draft
      if (
        aiReviewDraft &&
        typeof aiReviewDraft === 'object' &&
        Array.isArray(aiReviewDraft.customFields)
      ) {
        customFields = aiReviewDraft.customFields.map((cf: any) => ({
          slug: cf.slug,
          value: cf.value,
        }))
      } else {
        // Fall back to review draft or database values
        const reviewDraft = (post as any).reviewDraft || (post as any).review_draft
        if (
          reviewDraft &&
          typeof reviewDraft === 'object' &&
          Array.isArray(reviewDraft.customFields)
        ) {
          customFields = reviewDraft.customFields.map((cf: any) => ({
            slug: cf.slug,
            value: cf.value,
          }))
        } else {
          const cfVals = await PostCustomFieldValue.query()
            .where('postId', postId)
            .select('field_slug as slug', 'value')
          customFields = (cfVals || []).map((r: any) => ({ slug: r.slug, value: r.value }))
        }
      }
    } else {
      // Source mode: use database values
      const cfVals = await PostCustomFieldValue.query()
        .where('postId', postId)
        .select('field_slug as slug', 'value')
      customFields = (cfVals || []).map((r: any) => ({ slug: r.slug, value: r.value }))
    }

    // Get post fields based on mode
    // For 'source': use approved fields
    // For 'review': use review_draft if exists, otherwise approved
    // For 'ai-review': use ai_review_draft if exists, otherwise review_draft, otherwise approved
    let postFields: Record<string, any> = {
      slug: post.slug,
      title: post.title,
      status: (post as any).status,
      excerpt: (post as any).excerpt ?? null,
      metaTitle: (post as any).metaTitle ?? (post as any).meta_title ?? null,
      metaDescription: (post as any).metaDescription ?? (post as any).meta_description ?? null,
      canonicalUrl: (post as any).canonicalUrl ?? (post as any).canonical_url ?? null,
      robotsJson: (post as any).robotsJson ?? (post as any).robots_json ?? null,
      jsonldOverrides: (post as any).jsonldOverrides ?? (post as any).jsonld_overrides ?? null,
      socialTitle: (post as any).socialTitle ?? (post as any).social_title ?? null,
      socialDescription:
        (post as any).socialDescription ?? (post as any).social_description ?? null,
      socialImageId: (post as any).socialImageId ?? (post as any).social_image_id ?? null,
      noindex: Boolean((post as any).noindex),
      nofollow: Boolean((post as any).nofollow),
      featuredImageId: (post as any).featuredImageId ?? (post as any).featured_image_id ?? null,
    }

    if (mode === 'review') {
      const reviewDraft = (post as any).reviewDraft || (post as any).review_draft
      if (reviewDraft && typeof reviewDraft === 'object') {
        // Merge review_draft over approved fields
        postFields = {
          ...postFields,
          ...(reviewDraft.slug !== undefined ? { slug: reviewDraft.slug } : {}),
          ...(reviewDraft.title !== undefined ? { title: reviewDraft.title } : {}),
          ...(reviewDraft.status !== undefined ? { status: reviewDraft.status } : {}),
          ...(reviewDraft.excerpt !== undefined ? { excerpt: reviewDraft.excerpt ?? null } : {}),
          ...(reviewDraft.metaTitle !== undefined
            ? { metaTitle: reviewDraft.metaTitle ?? null }
            : {}),
          ...(reviewDraft.metaDescription !== undefined
            ? { metaDescription: reviewDraft.metaDescription ?? null }
            : {}),
          ...(reviewDraft.canonicalUrl !== undefined
            ? { canonicalUrl: reviewDraft.canonicalUrl ?? null }
            : {}),
          ...(reviewDraft.robotsJson !== undefined
            ? { robotsJson: reviewDraft.robotsJson ?? null }
            : {}),
          ...(reviewDraft.jsonldOverrides !== undefined
            ? { jsonldOverrides: reviewDraft.jsonldOverrides ?? null }
            : {}),
          ...(reviewDraft.socialTitle !== undefined
            ? { socialTitle: reviewDraft.socialTitle ?? null }
            : {}),
          ...(reviewDraft.socialDescription !== undefined
            ? { socialDescription: reviewDraft.socialDescription ?? null }
            : {}),
          ...(reviewDraft.socialImageId !== undefined
            ? { socialImageId: reviewDraft.socialImageId ?? null }
            : {}),
          ...(reviewDraft.noindex !== undefined ? { noindex: Boolean(reviewDraft.noindex) } : {}),
          ...(reviewDraft.nofollow !== undefined
            ? { nofollow: Boolean(reviewDraft.nofollow) }
            : {}),
          ...(reviewDraft.featuredImageId !== undefined
            ? { featuredImageId: reviewDraft.featuredImageId ?? null }
            : {}),
          ...(reviewDraft.taxonomyTermIds !== undefined
            ? { taxonomyTermIds: reviewDraft.taxonomyTermIds }
            : {}),
        }
      }
    } else if (mode === 'ai-review') {
      // First check ai_review_draft
      const aiReviewDraft = (post as any).aiReviewDraft || (post as any).ai_review_draft
      if (aiReviewDraft && typeof aiReviewDraft === 'object') {
        // Start with approved fields, then merge review_draft if exists, then merge ai_review_draft
        const reviewDraft = (post as any).reviewDraft || (post as any).review_draft
        if (reviewDraft && typeof reviewDraft === 'object') {
          postFields = {
            ...postFields,
            ...(reviewDraft.slug !== undefined ? { slug: reviewDraft.slug } : {}),
            ...(reviewDraft.title !== undefined ? { title: reviewDraft.title } : {}),
            ...(reviewDraft.status !== undefined ? { status: reviewDraft.status } : {}),
            ...(reviewDraft.excerpt !== undefined ? { excerpt: reviewDraft.excerpt ?? null } : {}),
            ...(reviewDraft.metaTitle !== undefined
              ? { metaTitle: reviewDraft.metaTitle ?? null }
              : {}),
            ...(reviewDraft.metaDescription !== undefined
              ? { metaDescription: reviewDraft.metaDescription ?? null }
              : {}),
            ...(reviewDraft.canonicalUrl !== undefined
              ? { canonicalUrl: reviewDraft.canonicalUrl ?? null }
              : {}),
            ...(reviewDraft.robotsJson !== undefined
              ? { robotsJson: reviewDraft.robotsJson ?? null }
              : {}),
            ...(reviewDraft.jsonldOverrides !== undefined
              ? { jsonldOverrides: reviewDraft.jsonldOverrides ?? null }
              : {}),
            ...(reviewDraft.socialTitle !== undefined
              ? { socialTitle: reviewDraft.socialTitle ?? null }
              : {}),
            ...(reviewDraft.socialDescription !== undefined
              ? { socialDescription: reviewDraft.socialDescription ?? null }
              : {}),
            ...(reviewDraft.socialImageId !== undefined
              ? { socialImageId: reviewDraft.socialImageId ?? null }
              : {}),
            ...(reviewDraft.noindex !== undefined ? { noindex: Boolean(reviewDraft.noindex) } : {}),
            ...(reviewDraft.nofollow !== undefined
              ? { nofollow: Boolean(reviewDraft.nofollow) }
              : {}),
            ...(reviewDraft.featuredImageId !== undefined
              ? { featuredImageId: reviewDraft.featuredImageId ?? null }
              : {}),
            ...(reviewDraft.taxonomyTermIds !== undefined
              ? { taxonomyTermIds: reviewDraft.taxonomyTermIds }
              : {}),
          }
        }
        // Then merge ai_review_draft on top
        postFields = {
          ...postFields,
          ...(aiReviewDraft.slug !== undefined ? { slug: aiReviewDraft.slug } : {}),
          ...(aiReviewDraft.title !== undefined ? { title: aiReviewDraft.title } : {}),
          ...(aiReviewDraft.status !== undefined ? { status: aiReviewDraft.status } : {}),
          ...(aiReviewDraft.excerpt !== undefined
            ? { excerpt: aiReviewDraft.excerpt ?? null }
            : {}),
          ...(aiReviewDraft.metaTitle !== undefined
            ? { metaTitle: aiReviewDraft.metaTitle ?? null }
            : {}),
          ...(aiReviewDraft.metaDescription !== undefined
            ? { metaDescription: aiReviewDraft.metaDescription ?? null }
            : {}),
          ...(aiReviewDraft.canonicalUrl !== undefined
            ? { canonicalUrl: aiReviewDraft.canonicalUrl ?? null }
            : {}),
          ...(aiReviewDraft.robotsJson !== undefined
            ? { robotsJson: aiReviewDraft.robotsJson ?? null }
            : {}),
          ...(aiReviewDraft.jsonldOverrides !== undefined
            ? { jsonldOverrides: aiReviewDraft.jsonldOverrides ?? null }
            : {}),
          ...(aiReviewDraft.socialTitle !== undefined
            ? { socialTitle: aiReviewDraft.socialTitle ?? null }
            : {}),
          ...(aiReviewDraft.socialDescription !== undefined
            ? { socialDescription: aiReviewDraft.socialDescription ?? null }
            : {}),
          ...(aiReviewDraft.socialImageId !== undefined
            ? { socialImageId: aiReviewDraft.socialImageId ?? null }
            : {}),
          ...(aiReviewDraft.noindex !== undefined
            ? { noindex: Boolean(aiReviewDraft.noindex) }
            : {}),
          ...(aiReviewDraft.nofollow !== undefined
            ? { nofollow: Boolean(aiReviewDraft.nofollow) }
            : {}),
          ...(aiReviewDraft.featuredImageId !== undefined
            ? { featuredImageId: aiReviewDraft.featuredImageId ?? null }
            : {}),
          ...(aiReviewDraft.taxonomyTermIds !== undefined
            ? { taxonomyTermIds: aiReviewDraft.taxonomyTermIds }
            : {}),
        }
      } else {
        // No ai_review_draft, fall back to review_draft if exists
        const reviewDraft = (post as any).reviewDraft || (post as any).review_draft
        if (reviewDraft && typeof reviewDraft === 'object') {
          postFields = {
            ...postFields,
            ...(reviewDraft.slug !== undefined ? { slug: reviewDraft.slug } : {}),
            ...(reviewDraft.title !== undefined ? { title: reviewDraft.title } : {}),
            ...(reviewDraft.status !== undefined ? { status: reviewDraft.status } : {}),
            ...(reviewDraft.excerpt !== undefined ? { excerpt: reviewDraft.excerpt ?? null } : {}),
            ...(reviewDraft.metaTitle !== undefined
              ? { metaTitle: reviewDraft.metaTitle ?? null }
              : {}),
            ...(reviewDraft.metaDescription !== undefined
              ? { metaDescription: reviewDraft.metaDescription ?? null }
              : {}),
            ...(reviewDraft.canonicalUrl !== undefined
              ? { canonicalUrl: reviewDraft.canonicalUrl ?? null }
              : {}),
            ...(reviewDraft.robotsJson !== undefined
              ? { robotsJson: reviewDraft.robotsJson ?? null }
              : {}),
            ...(reviewDraft.jsonldOverrides !== undefined
              ? { jsonldOverrides: reviewDraft.jsonldOverrides ?? null }
              : {}),
            ...(reviewDraft.socialTitle !== undefined
              ? { socialTitle: reviewDraft.socialTitle ?? null }
              : {}),
            ...(reviewDraft.socialDescription !== undefined
              ? { socialDescription: reviewDraft.socialDescription ?? null }
              : {}),
            ...(reviewDraft.socialImageId !== undefined
              ? { socialImageId: reviewDraft.socialImageId ?? null }
              : {}),
            ...(reviewDraft.noindex !== undefined ? { noindex: Boolean(reviewDraft.noindex) } : {}),
            ...(reviewDraft.nofollow !== undefined
              ? { nofollow: Boolean(reviewDraft.nofollow) }
              : {}),
            ...(reviewDraft.featuredImageId !== undefined
              ? { featuredImageId: reviewDraft.featuredImageId ?? null }
              : {}),
            ...(reviewDraft.taxonomyTermIds !== undefined
              ? { taxonomyTermIds: reviewDraft.taxonomyTermIds }
              : {}),
          }
        }
      }
    }

    let taxonomyTermIds: string[] = []
    if (mode === 'source') {
      const assigned = await db
        .from('post_taxonomy_terms')
        .where('post_id', postId)
        .select('taxonomy_term_id as termId')
      taxonomyTermIds = assigned.map((r: any) => String(r.termId))
    }

    const canonical: CanonicalPost = {
      metadata: {
        version: this.VERSION,
        exportedAt: new Date().toISOString(),
      },
      post: {
        id: post.id,
        type: post.type,
        locale: post.locale,
        slug: postFields.slug,
        title: postFields.title,
        status: postFields.status,
        excerpt: postFields.excerpt ?? null,
        metaTitle: postFields.metaTitle ?? null,
        metaDescription: postFields.metaDescription ?? null,
        canonicalUrl: postFields.canonicalUrl ?? null,
        robotsJson: postFields.robotsJson ?? null,
        jsonldOverrides: postFields.jsonldOverrides ?? null,
        socialTitle: postFields.socialTitle ?? null,
        socialDescription: postFields.socialDescription ?? null,
        socialImageId: postFields.socialImageId ?? null,
        noindex: Boolean(postFields.noindex),
        nofollow: Boolean(postFields.nofollow),
        featuredImageId: postFields.featuredImageId ?? null,
        customFields,
        taxonomyTermIds: postFields.taxonomyTermIds || taxonomyTermIds,
      } as any,
      modules: moduleRows.map((row: any) => {
        // Get base props (handle both JSON string and object)
        const baseProps = coerceJsonObject(row.props)
        let effectiveProps = { ...baseProps }
        let effectiveOverrides = row.overrides ? coerceJsonObject(row.overrides) : null

        // Merge with review or ai-review props based on mode
        if (mode === 'review') {
          if (row.review_props) {
            effectiveProps = { ...effectiveProps, ...coerceJsonObject(row.review_props) }
          }
          if (row.review_overrides) {
            effectiveOverrides = {
              ...coerceJsonObject(effectiveOverrides),
              ...coerceJsonObject(row.review_overrides),
            }
          }
        } else if (mode === 'ai-review') {
          // If AI review, include review changes first, then AI changes
          if (row.review_props) {
            effectiveProps = { ...effectiveProps, ...coerceJsonObject(row.review_props) }
          }
          if (row.review_overrides) {
            effectiveOverrides = {
              ...coerceJsonObject(effectiveOverrides),
              ...coerceJsonObject(row.review_overrides),
            }
          }
          if (row.ai_review_props) {
            effectiveProps = { ...effectiveProps, ...coerceJsonObject(row.ai_review_props) }
          }
          if (row.ai_review_overrides) {
            effectiveOverrides = {
              ...coerceJsonObject(effectiveOverrides),
              ...coerceJsonObject(row.ai_review_overrides),
            }
          }
        }

        return {
          postModuleId: row.postModuleId,
          moduleInstanceId: row.moduleInstanceId,
          type: row.type,
          scope: row.scope,
          orderIndex: row.orderIndex,
          locked: !!row.locked,
          props: effectiveProps,
          overrides: effectiveOverrides,
          globalSlug: row.globalSlug ?? null,
          adminLabel: row.admin_label ?? row.adminLabel ?? null,
        }
      }),
      translations: family.map((f: any) => ({ id: f.id, locale: f.locale })),
    }

    // ATOMIC DRAFT ENHANCEMENT:
    // If we are in review/ai-review mode and there's a draft with 'modules' list,
    // we should use that list to determine which modules exist and their state.
    // NOTE: We skip this if options.bypassAtomicDraft is true (used when refreshing the draft from DB).
    const currentDraft =
      !options.bypassAtomicDraft && mode === 'review'
        ? (post as any).reviewDraft
        : !options.bypassAtomicDraft && mode === 'ai-review'
          ? (post as any).aiReviewDraft
          : null

    if (currentDraft?.modules && Array.isArray(currentDraft.modules)) {
      // Use the modules list from the draft as the definitive list for ORDER and EXISTENCE.
      // However, we still want the latest PROPS/OVERRIDES from the granular database columns
      // (moduleRows) because they might have been updated individually via the API.
      const rowMap = new Map(moduleRows.map((r: any) => [r.postModuleId, r]))

      canonical.modules = currentDraft.modules.map((dm: any) => {
        const row = rowMap.get(dm.postModuleId || dm.id)

        // If we found a matching DB row, use its granularly-stored props/overrides
        if (row) {
          const baseProps = coerceJsonObject(row.props)
          let effectiveProps = { ...baseProps }
          let effectiveOverrides = row.overrides ? coerceJsonObject(row.overrides) : null

          if (mode === 'review') {
            if (row.review_props)
              effectiveProps = { ...effectiveProps, ...coerceJsonObject(row.review_props) }
            if (row.review_overrides)
              effectiveOverrides = {
                ...coerceJsonObject(effectiveOverrides),
                ...coerceJsonObject(row.review_overrides),
              }
          } else if (mode === 'ai-review') {
            if (row.review_props)
              effectiveProps = { ...effectiveProps, ...coerceJsonObject(row.review_props) }
            if (row.review_overrides)
              effectiveOverrides = {
                ...coerceJsonObject(effectiveOverrides),
                ...coerceJsonObject(row.review_overrides),
              }
            if (row.ai_review_props)
              effectiveProps = { ...effectiveProps, ...coerceJsonObject(row.ai_review_props) }
            if (row.ai_review_overrides)
              effectiveOverrides = {
                ...coerceJsonObject(effectiveOverrides),
                ...coerceJsonObject(row.ai_review_overrides),
              }
          }

          return {
            postModuleId: row.postModuleId,
            moduleInstanceId: row.moduleInstanceId,
            type: row.type,
            scope: row.scope,
            orderIndex: dm.orderIndex ?? row.orderIndex, // Prefer draft order if present
            locked: dm.locked ?? !!row.locked,
            props: effectiveProps,
            overrides: effectiveOverrides,
            globalSlug: row.globalSlug ?? null,
            adminLabel: dm.adminLabel ?? row.admin_label ?? row.adminLabel ?? null,
          }
        }

        // Fallback to draft data if DB row is gone (shouldn't happen for existing modules)
        return {
          postModuleId: dm.postModuleId || dm.id,
          moduleInstanceId: dm.moduleInstanceId || dm.moduleId,
          type: dm.type,
          scope: dm.scope === 'local' ? 'post' : dm.scope,
          orderIndex: dm.orderIndex,
          locked: !!dm.locked,
          props: dm.props,
          overrides: dm.overrides,
          globalSlug: dm.globalSlug,
          adminLabel: dm.adminLabel,
        }
      })
    }

    return canonical
  }

  /**
   * Create a new post from canonical JSON.
   */
  static async importCreate(data: CanonicalPost, userId: number) {
    if (!data || !data.metadata?.version?.startsWith('2.')) {
      throw new Error('Unsupported or missing version')
    }
    const p = data.post
    const post = await CreatePost.handle({
      type: p.type,
      locale: p.locale,
      slug: p.slug,
      title: p.title,
      status: p.status as any,
      excerpt: p.excerpt ?? null,
      metaTitle: p.metaTitle ?? null,
      metaDescription: p.metaDescription ?? null,
      socialTitle: p.socialTitle ?? null,
      socialDescription: p.socialDescription ?? null,
      socialImageId: p.socialImageId ?? null,
      noindex: Boolean(p.noindex),
      nofollow: Boolean(p.nofollow),
      userId,
    })
    // add modules
    for (const m of data.modules || []) {
      const created = await AddModuleToPost.handle({
        postId: post.id,
        moduleType: m.type,
        scope: m.scope,
        props: m.props ?? {},
        globalSlug: m.globalSlug ?? null,
        orderIndex: m.orderIndex,
        locked: !!m.locked,
      })
      // Apply overrides for non-local modules
      if (m.scope === 'global' && m.overrides) {
        await PostModule.query()
          .where('id', created.postModule.id)
          .update({ overrides: m.overrides, updated_at: new Date() } as any)
      }
    }
    // set custom fields by slug
    if (Array.isArray(data.post?.customFields) && data.post!.customFields!.length > 0) {
      const { randomUUID } = await import('node:crypto')
      for (const f of data.post!.customFields!) {
        const value = f.value // models handle JSON conversion
        await PostCustomFieldValue.create({
          id: randomUUID(),
          postId: post.id,
          fieldSlug: f.slug,
          value: value as any,
        })
      }
    }
    return post
  }

  /**
   * Replace an existing post's live data and modules from canonical JSON.
   */
  static async importReplace(postId: string, data: CanonicalPost) {
    if (!data || !data.metadata?.version?.startsWith('2.')) {
      throw new Error('Unsupported or missing version')
    }
    const p = data.post
    await UpdatePost.handle({
      postId,
      slug: p.slug,
      title: p.title,
      status: p.status as any,
      excerpt: p.excerpt ?? null,
      metaTitle: p.metaTitle ?? null,
      metaDescription: p.metaDescription ?? null,
      canonicalUrl: p.canonicalUrl ?? null,
      robotsJson: p.robotsJson ?? null,
      jsonldOverrides: p.jsonldOverrides ?? null,
      socialTitle: p.socialTitle ?? null,
      socialDescription: p.socialDescription ?? null,
      socialImageId: p.socialImageId ?? null,
      noindex: Boolean(p.noindex),
      nofollow: Boolean(p.nofollow),
    })
    // Remove existing modules and recreate
    const existing = await PostModule.query().where('postId', postId).preload('moduleInstance')
    if (existing.length) {
      const pmIds = existing.map((r: any) => r.id)
      await PostModule.query().whereIn('id', pmIds).delete()
      const deletable = existing
        .filter((r: any) => (r as any).moduleInstance?.scope !== 'global')
        .map((r: any) => (r as any).moduleInstance?.id)
        .filter(Boolean)
      if (deletable.length) {
        await ModuleInstance.query()
          .whereIn('id', deletable as string[])
          .delete()
      }
    }
    for (const m of data.modules || []) {
      const created = await AddModuleToPost.handle({
        postId,
        moduleType: m.type,
        scope: m.scope,
        props: m.props ?? {},
        globalSlug: m.globalSlug ?? null,
        orderIndex: m.orderIndex,
        locked: !!m.locked,
      })
      if (m.scope === 'global' && m.overrides) {
        await PostModule.query()
          .where('id', created.postModule.id)
          .update({ overrides: m.overrides, updated_at: new Date() } as any)
      }
    }
    // Replace custom fields by slug
    if (Array.isArray(data.post?.customFields)) {
      const { randomUUID } = await import('node:crypto')
      for (const f of data.post!.customFields!) {
        const value = typeof f.value === 'string' ? JSON.stringify(f.value) : f.value
        const existing = await PostCustomFieldValue.query()
          .where({ postId, fieldSlug: f.slug })
          .first()
        if (existing) {
          existing.value = value as any
          await existing.save()
        } else {
          await PostCustomFieldValue.create({
            id: randomUUID(),
            postId,
            fieldSlug: f.slug,
            value: value as any,
          })
        }
      }
    }
  }
}
