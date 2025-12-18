import db from '@adonisjs/lucid/services/db'
import postTypeConfigService from '#services/post_type_config_service'
import { randomUUID } from 'node:crypto'

export interface ApplyPostTaxonomyAssignmentsParams {
  postId: string
  postType: string
  termIds: string[]
}

export default class ApplyPostTaxonomyAssignments {
  /**
   * Replace taxonomy term assignments for a post.
   * Scoped to taxonomies enabled for the post type.
   */
  static async handle({ postId, postType, termIds }: ApplyPostTaxonomyAssignmentsParams): Promise<void> {
    const uiCfg = postTypeConfigService.getUiConfig(postType)
    const allowedTaxonomySlugs = Array.isArray((uiCfg as any).taxonomies)
      ? (uiCfg as any).taxonomies
      : []
    
    if (allowedTaxonomySlugs.length === 0) return

    // Normalize and dedupe IDs
    const normalizedTermIds = Array.from(new Set(termIds.map((x) => String(x)).filter(Boolean)))

    await db.transaction(async (trx) => {
      // 1. Resolve requested terms -> taxonomy slug and filter to allowed taxonomies
      const rows = normalizedTermIds.length
        ? await trx
            .from('taxonomy_terms as tt')
            .join('taxonomies as t', 'tt.taxonomy_id', 't.id')
            .whereIn('tt.id', normalizedTermIds)
            .whereIn('t.slug', allowedTaxonomySlugs)
            .select('tt.id as termId', 't.slug as taxonomySlug')
        : []

      // 2. Remove existing assignments for allowed taxonomies only
      // Subquery to find terms belonging to allowed taxonomies
      const allowedTaxonomyIdsQuery = trx
        .from('taxonomies')
        .whereIn('slug', allowedTaxonomySlugs)
        .select('id')

      await trx
        .from('post_taxonomy_terms')
        .where('post_id', postId)
        .whereIn(
          'taxonomy_term_id',
          trx
            .from('taxonomy_terms')
            .whereIn('taxonomy_id', allowedTaxonomyIdsQuery)
            .select('id')
        )
        .delete()

      if (rows.length === 0) return

      // 3. Insert new assignments
      const now = new Date()
      const insertRows = rows.map((r) => ({
        id: randomUUID(),
        post_id: postId,
        taxonomy_term_id: r.termId,
        created_at: now,
        updated_at: now,
      }))

      await trx.table('post_taxonomy_terms').insert(insertRows)
    })
  }
}

