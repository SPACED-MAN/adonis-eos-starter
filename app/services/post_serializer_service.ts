import CreatePost from '#actions/posts/create_post'
import UpdatePost from '#actions/posts/update_post'
import AddModuleToPost from '#actions/posts/add_module_to_post'
import Post from '#models/post'
import PostModule from '#models/post_module'
import ModuleInstance from '#models/module_instance'
import PostCustomFieldValue from '#models/post_custom_field_value'

type CanonicalModule = {
  type: string
  scope: 'local' | 'global'
  orderIndex: number
  locked?: boolean
  props?: Record<string, any> | null
  overrides?: Record<string, any> | null
  globalSlug?: string | null
}

export type CanonicalPost = {
  version: 1
  post: {
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
    customFields?: Array<{ slug: string; value: any }>
  }
  modules: CanonicalModule[]
  translations?: Array<{ id: string; locale: string }>
}

export default class PostSerializerService {
  /**
   * Serialize a post (approved/live fields) and its modules into a canonical JSON object.
   */
  static async serialize(postId: string): Promise<CanonicalPost> {
    const post = await Post.query().where('id', postId).first()
    if (!post) {
      throw new Error('Post not found')
    }
    const modules = await PostModule.query()
      .where('postId', postId)
      .orderBy('orderIndex', 'asc')
      .preload('moduleInstance')

    // Family translations list
    const baseId = (post as any).translationOfId || post.id
    const family = await Post.query()
      .where('translationOfId', baseId)
      .orWhere('id', baseId)
      .select('id', 'locale')

    // Custom fields (slug:value) by slug from values table
    const cfVals = await PostCustomFieldValue.query()
      .where('postId', postId)
      .select('field_slug as slug', 'value')

    const canonical: CanonicalPost = {
      version: 1 as const,
      post: {
        type: post.type,
        locale: post.locale,
        slug: post.slug,
        title: post.title,
        status: (post as any).status,
        excerpt: (post as any).excerpt ?? null,
        metaTitle: (post as any).metaTitle ?? (post as any).meta_title ?? null,
        metaDescription: (post as any).metaDescription ?? (post as any).meta_description ?? null,
        canonicalUrl: (post as any).canonicalUrl ?? (post as any).canonical_url ?? null,
        robotsJson: (post as any).robotsJson ?? (post as any).robots_json ?? null,
        jsonldOverrides: (post as any).jsonldOverrides ?? (post as any).jsonld_overrides ?? null,
        customFields: (cfVals || []).map((r: any) => ({ slug: r.slug, value: r.value })),
      },
      modules: modules.map((pm: any) => {
        const mi = pm.moduleInstance as any as ModuleInstance
        return {
          type: mi?.type,
          scope: mi?.scope === 'post' ? 'local' : 'global',
          orderIndex: pm.orderIndex,
          locked: pm.locked,
          props: mi?.props ?? null,
          overrides: pm.overrides ?? null,
          globalSlug: mi?.globalSlug ?? null,
        }
      }),
      translations: family.map((f: any) => ({ id: f.id, locale: f.locale })),
    }
    return canonical
  }

  /**
   * Create a new post from canonical JSON.
   */
  static async importCreate(data: CanonicalPost, userId: number) {
    if (!data || data.version !== 1) throw new Error('Unsupported or missing version')
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
        const value = typeof f.value === 'string' ? JSON.stringify(f.value) : f.value
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
    if (!data || data.version !== 1) throw new Error('Unsupported or missing version')
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
    })
    // Remove existing modules and recreate
    const existing = await PostModule.query()
      .where('postId', postId)
      .preload('moduleInstance')
    if (existing.length) {
      const pmIds = existing.map((r: any) => r.id)
      await PostModule.query().whereIn('id', pmIds).delete()
      const deletable = existing
        .filter((r: any) => (r as any).moduleInstance?.scope !== 'global')
        .map((r: any) => (r as any).moduleInstance?.id)
        .filter(Boolean)
      if (deletable.length) {
        await ModuleInstance.query().whereIn('id', deletable as string[]).delete()
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
