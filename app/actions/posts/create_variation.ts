import Post from '#models/post'
import PostModule from '#models/post_module'
import PostCustomFieldValue from '#models/post_custom_field_value'
import db from '@adonisjs/lucid/services/db'
import { randomUUID } from 'node:crypto'

type CreateVariationParams = {
  sourcePostId: string
  variation: string
  userId: number
}

export default class CreateVariation {
  /**
   * Creates a new variation of a post by cloning its structure and modules.
   * Currently clones the 'approved' version (Source).
   */
  static async handle({ sourcePostId, variation, userId }: CreateVariationParams): Promise<Post> {
    const sourcePost = await Post.findOrFail(sourcePostId)

    // Ensure the source post has an abGroupId and variation 'A' if not already set
    let changed = false
    if (!sourcePost.abGroupId) {
      sourcePost.abGroupId = sourcePost.id
      changed = true
    }
    // Only set 'A' if it's the leader and doesn't have a variation set
    if (sourcePost.id === sourcePost.abGroupId && !sourcePost.abVariation) {
      sourcePost.abVariation = 'A'
      changed = true
    }
    if (changed) {
      await sourcePost.save()
    }

    // Check if variation already exists for this group and locale
    const existing = await Post.query()
      .where('abGroupId', sourcePost.abGroupId)
      .where('locale', sourcePost.locale)
      .where('abVariation', variation)
      .first()

    if (existing) {
      throw new Error(`Variation ${variation} already exists for this post and locale.`)
    }

    return await db.transaction(async (trx) => {
      // 1. Clone the post record
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      
      // Strict slugification helper to match regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      const sanitizeSlug = (s: string) => {
        return s.toLowerCase()
          .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with a single dash
          .replace(/^-+|-+$/g, '') // Trim dashes from start and end
          .replace(/-+/g, '-') // Collapsing double dashes into one
      }

      const baseSlug = sanitizeSlug(sourcePost.slug)
      const variationSlug = sanitizeSlug(`${baseSlug}-v-${variation}-${randomSuffix}`)
      
      const newPost = await Post.create(
        {
          type: sourcePost.type,
          slug: variationSlug,
          title: `${sourcePost.title} (Variation ${variation})`,
          excerpt: sourcePost.excerpt,
          status: 'draft',
          locale: sourcePost.locale,
          featuredImageId: sourcePost.featuredImageId,
          metaTitle: sourcePost.metaTitle,
          metaDescription: sourcePost.metaDescription,
          canonicalUrl: sourcePost.canonicalUrl || null, // Variations should point to main post's canonical URL
          robotsJson: { index: false, follow: false }, // Variations shouldn't be indexed directly
          jsonldOverrides: sourcePost.jsonldOverrides,
          parentId: sourcePost.parentId,
          orderIndex: sourcePost.orderIndex,
          moduleGroupId: sourcePost.moduleGroupId,
          userId: userId,
          authorId: userId,
          abVariation: variation,
          abGroupId: sourcePost.abGroupId,
        },
        { client: trx }
      )

      // 2. Clone modules
      const sourceModules = await PostModule.query({ client: trx })
        .where('postId', sourcePost.id)
        .orderBy('orderIndex', 'asc')
        .preload('moduleInstance')

      for (const sm of sourceModules) {
        const mi = sm.moduleInstance
        
        let newModuleInstanceId = mi.id

        if (mi.scope === 'post') {
          // Clone local module instance
          const [created] = await trx
            .table('module_instances')
            .insert({
              id: randomUUID(),
              scope: 'post',
              type: mi.type,
              props: mi.props,
              created_at: new Date(),
              updated_at: new Date(),
            })
            .returning('id')
          newModuleInstanceId = created.id
        }

        await trx.table('post_modules').insert({
          id: randomUUID(),
          post_id: newPost.id,
          module_id: newModuleInstanceId,
          order_index: sm.orderIndex,
          overrides: sm.overrides,
          locked: sm.locked,
          admin_label: sm.adminLabel,
          created_at: new Date(),
          updated_at: new Date(),
        })
      }

      // 3. Clone custom fields
      const sourceFields = await PostCustomFieldValue.query({ client: trx }).where('postId', sourcePost.id)
      for (const sf of sourceFields) {
        await PostCustomFieldValue.create(
          {
            postId: newPost.id,
            fieldSlug: sf.fieldSlug,
            value: sf.value,
          },
          { client: trx }
        )
      }

      return newPost
    })
  }
}

