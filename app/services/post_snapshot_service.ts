import db from '@adonisjs/lucid/services/db'
import { CanonicalPost } from '#services/post_serializer_service'
import UpdatePost from '#actions/posts/update_post'
import AddModuleToPost from '#actions/posts/add_module_to_post'
import UpsertPostCustomFields from '#actions/posts/upsert_post_custom_fields'
import ApplyPostTaxonomyAssignments from '#actions/posts/apply_post_taxonomy_assignments'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import moduleRegistry from '#services/module_registry'
import { markdownToLexical } from '#helpers/markdown_to_lexical'

export type SnapshotApplyMode = 'source' | 'review' | 'ai-review'

/**
 * Post Snapshot Service
 *
 * Centralizes the logic for applying a canonical post snapshot to the database.
 * This ensures consistency between manual edits, AI agent edits, and promotion workflows.
 */
export default class PostSnapshotService {
  /**
   * Apply a canonical post snapshot to a specific mode (source, review, or ai-review).
   */
  static async apply(
    postId: string,
    snapshot: CanonicalPost,
    mode: SnapshotApplyMode
  ): Promise<void> {
    // Ensure all rich text fields are converted from Markdown to Lexical if needed
    this.autoConvertRichText(snapshot)

    if (mode === 'source') {
      await db.transaction(async (trx) => {
        await this.applyToSource(postId, snapshot, trx)
        // When promoting to source, we clear the review draft data
        await this.clearDraft(postId, 'review', trx)
      })
    } else {
      await this.applyToDraft(postId, snapshot, mode)
    }
  }

  /**
   * Fully restore a post and all its versions from a composite revision snapshot.
   * This handles Source, Review, and AI Review versions at once, including
   * recreating any modules that were deleted since the revision was captured.
   */
  static async restoreActiveVersionsSnapshot(postId: string, snapshot: any): Promise<void> {
    if (snapshot?.kind !== 'active-versions') {
      throw new Error('Unsupported snapshot kind for full restoration')
    }

    const postSnap = snapshot.post
    if (!postSnap) throw new Error('Missing post data in snapshot')

    await db.transaction(async (trx) => {
      const now = new Date()

      // 1. Restore Source fields
      await UpdatePost.handle(
        {
          postId,
          slug: postSnap.slug,
          title: postSnap.title,
          status: postSnap.status,
          excerpt: postSnap.excerpt ?? null,
          parentId: postSnap.parentId ?? null,
          orderIndex: postSnap.orderIndex ?? 0,
          metaTitle: postSnap.metaTitle ?? null,
          metaDescription: postSnap.metaDescription ?? null,
          canonicalUrl: postSnap.canonicalUrl ?? null,
          robotsJson: postSnap.robotsJson ?? null,
          jsonldOverrides: postSnap.jsonldOverrides ?? null,
          featuredImageId: postSnap.featuredImageId ?? null,
        } as any,
        trx
      )

      // 2. Restore draft payloads (columns)
      await trx
        .from('posts')
        .where('id', postId)
        .update({
          review_draft: snapshot.drafts?.reviewDraft ?? null,
          ai_review_draft: snapshot.drafts?.aiReviewDraft ?? null,
          updated_at: now,
        } as any)

      // 3. Sync Source custom fields
      if (Array.isArray(postSnap.customFields)) {
        await trx.from('post_custom_field_values').where('post_id', postId).delete()
        for (const cf of postSnap.customFields) {
          const { randomUUID } = await import('node:crypto')
          await trx.table('post_custom_field_values').insert({
            id: randomUUID(),
            post_id: postId,
            field_slug: cf.fieldSlug,
            value: cf.value ?? null,
            created_at: now,
            updated_at: now,
          })
        }
      }

      // 4. Sync Source taxonomy assignments
      if (Array.isArray(postSnap.taxonomyTermIds)) {
        await trx.from('post_taxonomy_terms').where('post_id', postId).delete()
        for (const termId of postSnap.taxonomyTermIds) {
          const { randomUUID } = await import('node:crypto')
          await trx.table('post_taxonomy_terms').insert({
            id: randomUUID(),
            post_id: postId,
            taxonomy_term_id: String(termId),
            created_at: now,
            updated_at: now,
          })
        }
      }

      // 5. Sync Modules (Syncing list)
      if (Array.isArray(snapshot.modules)) {
        const incomingModules = snapshot.modules as any[]
        const incomingPmIds = new Set(incomingModules.map((m) => String(m.postModuleId)))

        // a. Delete modules currently attached to the post that are NOT in the revision
        const currentPms = await trx
          .from('post_modules')
          .where('post_id', postId)
          .select('id', 'module_id')

        for (const pm of currentPms) {
          if (!incomingPmIds.has(String(pm.id))) {
            await trx.from('post_modules').where('id', pm.id).delete()
            // If it's a local/post module, delete the instance too
            const mi = await trx
              .from('module_instances')
              .where('id', pm.module_id)
              .select('scope')
              .first()
            if (mi && (mi.scope === 'post' || mi.scope === 'local')) {
              await trx.from('module_instances').where('id', pm.module_id).delete()
            }
          }
        }

        // b. Restore/Recreate modules from the revision
        for (const m of incomingModules) {
          const pmId = String(m.postModuleId)
          const miId = String(m.moduleInstanceId)

          // i. Restore/Recreate module_instance
          const existingMi = await trx.from('module_instances').where('id', miId).first()
          const resolvedScope = m.scope === 'local' ? 'post' : m.scope
          const miData = {
            type: m.type,
            scope: resolvedScope,
            post_id: resolvedScope === 'post' ? postId : null,
            global_slug: m.globalSlug,
            global_label: m.globalLabel,
            props: m.props ?? {},
            review_props: m.reviewProps ?? null,
            ai_review_props: m.aiReviewProps ?? null,
            updated_at: now,
          }

          if (existingMi) {
            await trx.from('module_instances').where('id', miId).update(miData)
          } else {
            await trx.table('module_instances').insert({
              ...miData,
              id: miId,
              created_at: now,
            })
          }

          // ii. Restore/Recreate post_module join
          const existingPm = await trx.from('post_modules').where('id', pmId).first()
          const pmData = {
            post_id: postId,
            module_id: miId,
            order_index: m.orderIndex ?? 0,
            overrides: m.overrides ?? null,
            review_overrides: m.reviewOverrides ?? null,
            ai_review_overrides: m.aiReviewOverrides ?? null,
            locked: !!m.locked,
            admin_label: m.adminLabel ?? null,
            review_added: !!m.flags?.reviewAdded,
            review_deleted: !!m.flags?.reviewDeleted,
            ai_review_added: !!m.flags?.aiReviewAdded,
            ai_review_deleted: !!m.flags?.aiReviewDeleted,
            updated_at: now,
          }

          if (existingPm) {
            await trx.from('post_modules').where('id', pmId).update(pmData)
          } else {
            await trx.table('post_modules').insert({
              ...pmData,
              id: pmId,
              created_at: now,
            })
          }
        }
      }
    })
  }

  /**
   * Clear draft data from both the JSONB column and the granular shadow columns.
   */
  static async clearDraft(
    postId: string,
    mode: 'review' | 'ai-review',
    trx?: TransactionClientContract
  ): Promise<void> {
    const run = async (t: TransactionClientContract) => {
      const draftCol = mode === 'review' ? 'review_draft' : 'ai_review_draft'
      await t
        .from('posts')
        .where('id', postId)
        .update({ [draftCol]: null, updated_at: new Date() })
      await this.clearDraftShadowColumns(postId, mode, t)
    }

    if (trx) await run(trx)
    else await db.transaction(async (t) => await run(t))
  }

  /**
   * Clear only the granular shadow columns for a mode.
   */
  private static async clearDraftShadowColumns(
    postId: string,
    mode: 'review' | 'ai-review',
    trx: TransactionClientContract
  ): Promise<void> {
    const propsCol = mode === 'review' ? 'review_props' : 'ai_review_props'
    const overridesCol = mode === 'review' ? 'review_overrides' : 'ai_review_overrides'
    const addedCol = mode === 'review' ? 'review_added' : 'ai_review_added'
    const deletedCol = mode === 'review' ? 'review_deleted' : 'ai_review_deleted'

    const pmIds = await trx.from('post_modules').where('post_id', postId).select('id', 'module_id')
    const moduleIds = pmIds.map((pm) => pm.module_id)

    // 1. Clear props in module_instances
    if (moduleIds.length > 0) {
      await trx
        .from('module_instances')
        .whereIn('id', moduleIds)
        .update({ [propsCol]: null, updated_at: new Date() })
    }

    // 2. Clear overrides and flags in post_modules
    await trx
      .from('post_modules')
      .where('post_id', postId)
      .update({
        [overridesCol]: null,
        [addedCol]: false,
        [deletedCol]: false,
        updated_at: new Date(),
      })
  }

  /**
   * Create a CanonicalPost from an editor/agent payload.
   */
  static fromPayload(payload: any): CanonicalPost {
    return {
      metadata: {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
      },
      post: {
        type: payload.type,
        locale: payload.locale,
        slug: payload.slug,
        title: payload.title,
        status: payload.status,
        excerpt: payload.excerpt,
        metaTitle: payload.metaTitle,
        metaDescription: payload.metaDescription,
        canonicalUrl: payload.canonicalUrl,
        robotsJson: payload.robotsJson,
        jsonldOverrides: payload.jsonldOverrides,
        socialTitle: payload.socialTitle,
        socialDescription: payload.socialDescription,
        socialImageId: payload.socialImageId,
        noindex: payload.noindex,
        nofollow: payload.nofollow,
        featuredImageId: payload.featuredImageId,
        customFields: payload.customFields,
        taxonomyTermIds: payload.taxonomyTermIds,
      } as any,
      modules: (payload.modules || []).map((m: any) => ({
        postModuleId: m.postModuleId || m.id,
        moduleInstanceId: m.moduleInstanceId || m.moduleId,
        type: m.type,
        scope: m.scope === 'local' ? 'post' : m.scope,
        orderIndex: m.orderIndex,
        locked: !!m.locked,
        props: m.props,
        overrides: m.overrides,
        globalSlug: m.globalSlug,
        adminLabel: m.adminLabel,
      })),
    }
  }

  /**
   * Refresh the atomic draft JSON column for a post based on its current granular database state.
   */
  static async refreshAtomicDraft(postId: string, mode: 'review' | 'ai-review'): Promise<void> {
    const PostSerializerService = (await import('#services/post_serializer_service')).default

    // 1. Serialize the current state for the requested mode
    // We pass bypassAtomicDraft=true to ensure we read the latest granular changes from the database
    // instead of reading the stale draft JSON we're about to replace.
    const snapshot = await PostSerializerService.serialize(postId, mode, {
      bypassAtomicDraft: true,
    })

    // 2. Apply the snapshot back to the draft column (this only updates the JSONB column)
    const column = mode === 'review' ? 'review_draft' : 'ai_review_draft'

    await db
      .from('posts')
      .where('id', postId)
      .update({
        [column]: {
          ...snapshot.post,
          modules: snapshot.modules,
          savedAt: new Date().toISOString(),
          savedBy: 'System (Sync)',
        },
        updated_at: new Date(),
      })
  }

  /**
   * Automatically convert any string props in richtext fields to Lexical JSON.
   * Recursively handles nested objects and repeaters.
   */
  private static autoConvertRichText(snapshot: CanonicalPost): void {
    for (const m of snapshot.modules) {
      if (m.props && moduleRegistry.has(m.type)) {
        const schema = moduleRegistry.getSchema(m.type)
        this.processPropsForRichText(m.props, schema.fieldSchema)
      }
    }
  }

  /**
   * Recursive helper to find and convert richtext fields in props.
   */
  private static processPropsForRichText(props: any, fieldSchema: any[]): void {
    if (!props || typeof props !== 'object') return

    for (const key of Object.keys(props)) {
      const field = fieldSchema.find((f: any) => f.slug === key)
      if (!field) continue

      if (field.type === 'richtext') {
        const val = props[key]
        if (typeof val === 'string' && val.trim() !== '') {
          const trimmed = val.trim()
          const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
          if (!looksJson) {
            props[key] = markdownToLexical(val, { skipFirstH1: false })
          }
        }
      } else if (field.type === 'object' && field.fields) {
        this.processPropsForRichText(props[key], field.fields)
      } else if (field.type === 'repeater' && field.item?.fields && Array.isArray(props[key])) {
        for (const item of props[key]) {
          this.processPropsForRichText(item, field.item.fields)
        }
      }
    }
  }

  /**
   * Apply snapshot directly to live tables (Source).
   */
  private static async applyToSource(
    postId: string,
    snapshot: CanonicalPost,
    trx: TransactionClientContract
  ): Promise<void> {
    const p = snapshot.post

    // 1. Update basic fields
    await UpdatePost.handle(
      {
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
        noindex: p.noindex ?? false,
        nofollow: p.nofollow ?? false,
        featuredImageId: p.featuredImageId ?? null,
      },
      trx
    )

    // 2. Update custom fields
    if (Array.isArray(p.customFields)) {
      await UpsertPostCustomFields.handle(
        {
          postId,
          customFields: p.customFields.map((cf) => ({ slug: cf.slug, value: cf.value })),
        },
        trx
      )
    }

    // 3. Update taxonomy assignments
    if (Array.isArray(p.taxonomyTermIds)) {
      const postRow = await trx.from('posts').where('id', postId).select('type').first()
      await ApplyPostTaxonomyAssignments.handle(
        {
          postId,
          postType: postRow.type,
          termIds: p.taxonomyTermIds.map((id) => String(id)),
        },
        trx
      )
    }

    // 4. Update modules (Syncing list)
    const existingModules = await trx
      .from('post_modules')
      .where('post_id', postId)
      .select('id', 'module_id', 'order_index')

    const existingIds = new Set(existingModules.map((m) => m.id))
    const incomingIds = new Set(snapshot.modules.map((m) => m.postModuleId).filter(Boolean))

    // Delete modules not in snapshot
    for (const m of existingModules) {
      if (!incomingIds.has(m.id)) {
        await trx.from('post_modules').where('id', m.id).delete()
        const mi = await trx
          .from('module_instances')
          .where('id', m.module_id)
          .select('scope')
          .first()
        if (mi && (mi.scope === 'post' || mi.scope === 'local')) {
          await trx.from('module_instances').where('id', m.module_id).delete()
        }
      }
    }

    // Update or Create modules
    for (const m of snapshot.modules) {
      if (m.postModuleId && existingIds.has(m.postModuleId)) {
        const miId = m.moduleInstanceId
        if (miId) {
          const updateMi: any = { updated_at: new Date() }
          if (m.scope === 'local' || m.scope === 'post') {
            updateMi.props = m.props
          }
          await trx.from('module_instances').where('id', miId).update(updateMi)
        }

        const updatePm: any = {
          order_index: m.orderIndex,
          locked: !!m.locked,
          admin_label: m.adminLabel ?? null,
          updated_at: new Date(),
        }
        if (m.scope === 'global') {
          updatePm.overrides = m.overrides
        }
        await trx.from('post_modules').where('id', m.postModuleId).update(updatePm)
      } else {
        await AddModuleToPost.handle(
          {
            postId,
            moduleType: m.type,
            scope: m.scope,
            props: m.props ?? {},
            globalSlug: m.globalSlug ?? null,
            orderIndex: m.orderIndex,
            locked: !!m.locked,
            overrides: m.overrides ?? null,
            adminLabel: m.adminLabel ?? null,
          },
          trx
        )
      }
    }
  }

  /**
   * Apply snapshot to a draft column (review_draft or ai_review_draft).
   */
  private static async applyToDraft(
    postId: string,
    snapshot: CanonicalPost,
    mode: 'review' | 'ai-review'
  ): Promise<void> {
    const column = mode === 'review' ? 'review_draft' : 'ai_review_draft'

    await db.transaction(async (trx) => {
      // 1. Update the JSON column
      await trx
        .from('posts')
        .where('id', postId)
        .update({
          [column]: {
            ...snapshot.post,
            modules: snapshot.modules,
            savedAt: new Date().toISOString(),
            savedBy: mode === 'ai-review' ? 'AI Agent' : 'User',
          },
          updated_at: new Date(),
        })

      // 2. Update granular columns for the editor interface
      const propsCol = mode === 'review' ? 'review_props' : 'ai_review_props'
      const overridesCol = mode === 'review' ? 'review_overrides' : 'ai_review_overrides'
      const deletedCol = mode === 'review' ? 'review_deleted' : 'ai_review_deleted'
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

      const snapshotPostModuleIds = new Set(
        snapshot.modules.map((m) => m.postModuleId).filter((id) => id && uuidRegex.test(id))
      )

      // Mark missing modules as deleted in this draft mode
      if (snapshotPostModuleIds.size === 0) {
        await trx
          .from('post_modules')
          .where('post_id', postId)
          .update({ [deletedCol]: true, updated_at: new Date() })
      } else {
        await trx
          .from('post_modules')
          .where('post_id', postId)
          .whereNotIn('id', Array.from(snapshotPostModuleIds))
          .update({ [deletedCol]: true, updated_at: new Date() })

        // Ensure present modules are NOT marked as deleted
        await trx
          .from('post_modules')
          .where('post_id', postId)
          .whereIn('id', Array.from(snapshotPostModuleIds))
          .update({ [deletedCol]: false, updated_at: new Date() })
      }

      for (const m of snapshot.modules) {
        // Only update granular columns if we have valid UUIDs.
        if (m.moduleInstanceId && uuidRegex.test(m.moduleInstanceId)) {
          if (m.scope === 'post' || m.scope === 'local') {
            await trx
              .from('module_instances')
              .where('id', m.moduleInstanceId)
              .update({ [propsCol]: m.props, updated_at: new Date() })
          }
        }
        if (m.postModuleId && uuidRegex.test(m.postModuleId)) {
          const pmUpdate: any = { admin_label: m.adminLabel ?? null, updated_at: new Date() }
          if (m.scope === 'global') {
            pmUpdate[overridesCol] = m.overrides
          }
          await trx.from('post_modules').where('id', m.postModuleId).update(pmUpdate)
        }
      }
    })
  }
}
