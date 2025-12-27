import Post from '#models/post'
import PostModule from '#models/post_module'
import ModuleInstance from '#models/module_instance'
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
   * Creates the variation for EVERY locale in the translation family.
   */
  static async handle({ sourcePostId, variation, userId }: CreateVariationParams): Promise<Post> {
    const sourcePost = await Post.findOrFail(sourcePostId)
    const originalPost = await sourcePost.getOriginal()
    const family = await originalPost.getAllTranslations()

    // 1. Ensure the translation family has a shared abGroupId
    const abGroupId = originalPost.abGroupId || originalPost.id
    for (const member of family) {
      if (member.abGroupId !== abGroupId || (member.id === abGroupId && !member.abVariation)) {
        member.abGroupId = abGroupId
        // If it's the leader and doesn't have a variation set, it's 'A'
        if (member.id === abGroupId && !member.abVariation) {
          member.abVariation = 'A'
        }
        await member.save()
      }
    }

    // 2. Check if variation already exists for this group and the source locale
    const existing = await Post.query()
      .where('abGroupId', abGroupId)
      .where('locale', sourcePost.locale)
      .where('abVariation', variation)
      .first()

    if (existing) {
      throw new Error(`Variation ${variation} already exists for this post and locale.`)
    }

    return await db.transaction(async (trx) => {
      // 3. Create variations for all locales in the family
      // We process the original first so we can link translations to it
      const sortedFamily = [...family].sort((a, b) => {
        if (!a.translationOfId) return -1
        if (!b.translationOfId) return 1
        return 0
      })

      let newOriginalVariation: Post | null = null
      let resultPost: Post | null = null

      for (const member of sortedFamily) {
        const isOriginalMember = !member.translationOfId
        const newPost = await this.clonePost(
          member,
          variation,
          userId,
          trx,
          isOriginalMember ? null : newOriginalVariation?.id || null
        )

        if (isOriginalMember) {
          newOriginalVariation = newPost
        }

        if (member.id === sourcePost.id) {
          resultPost = newPost
        }
      }

      return resultPost!
    })
  }

  /**
   * Helper to clone a single post record and its modules
   */
  private static async clonePost(
    sourcePost: Post,
    variation: string,
    userId: number,
    trx: any,
    translationOfId: string | null
  ): Promise<Post> {
    const randomSuffix = Math.random().toString(36).substring(2, 8)

    // Strict slugification helper to match regex: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    const sanitizeSlug = (s: string) => {
      return s
        .toLowerCase()
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
        translationOfId: translationOfId,
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
      const mi = sm.moduleInstance as any as ModuleInstance
      let newModuleInstanceId = mi.id

      if (mi.scope === 'post') {
        // Clone local module instance
        const createdMi = await ModuleInstance.create(
          {
            id: randomUUID(),
            scope: 'post',
            type: mi.type,
            props: mi.props,
          },
          { client: trx }
        )
        newModuleInstanceId = createdMi.id
      }

      await PostModule.create(
        {
          id: randomUUID(),
          postId: newPost.id,
          moduleId: newModuleInstanceId,
          orderIndex: sm.orderIndex,
          overrides: sm.overrides,
          locked: sm.locked,
          adminLabel: sm.adminLabel,
        },
        { client: trx }
      )
    }

    // 3. Clone custom fields
    const sourceFields = await PostCustomFieldValue.query({ client: trx }).where(
      'postId',
      sourcePost.id
    )
    for (const sf of sourceFields) {
      await PostCustomFieldValue.create(
        {
          id: randomUUID(),
          postId: newPost.id,
          fieldSlug: sf.fieldSlug,
          value: sf.value,
        },
        { client: trx }
      )
    }

    return newPost
  }
}
