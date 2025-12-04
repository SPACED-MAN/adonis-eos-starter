import db from '@adonisjs/lucid/services/db'
import CreatePost from '#actions/posts/create_post'
import UpdatePost from '#actions/posts/update_post'
import AddModuleToPost from '#actions/posts/add_module_to_post'

type CanonicalModule = {
  type: string
  scope: 'local' | 'static' | 'global'
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
    const post = await db.from('posts').where('id', postId).first()
    if (!post) {
      throw new Error('Post not found')
    }
    const modules = await db
      .from('post_modules')
      .join('module_instances', 'post_modules.module_id', 'module_instances.id')
      .where('post_modules.post_id', postId)
      .orderBy('post_modules.order_index', 'asc')
      .select(
        'module_instances.type',
        'module_instances.scope',
        'module_instances.global_slug',
        'module_instances.props',
        'post_modules.overrides',
        'post_modules.order_index as orderIndex',
        'post_modules.locked'
      )

    // Family translations list
    const baseId = post.translation_of_id || post.id
    const family = await db
      .from('posts')
      .where('translation_of_id', baseId)
      .orWhere('id', baseId)
      .select('id', 'locale')

    // Custom fields (slug:value) by slug from values table
    const cfVals = await db
      .from('post_custom_field_values as v')
      .where('v.post_id', postId)
      .select('v.field_slug as slug', 'v.value as value')

    const canonical: CanonicalPost = {
      version: 1 as const,
      post: {
        type: post.type,
        locale: post.locale,
        slug: post.slug,
        title: post.title,
        status: post.status,
        excerpt: post.excerpt ?? null,
        metaTitle: post.meta_title ?? null,
        metaDescription: post.meta_description ?? null,
        canonicalUrl: post.canonical_url ?? null,
        robotsJson: post.robots_json ?? null,
        jsonldOverrides: post.jsonld_overrides ?? null,
        customFields: (cfVals || []).map((r: any) => ({ slug: r.slug, value: r.value })),
      },
      modules: modules.map((m: any) => ({
        type: m.type,
        scope: m.scope === 'post' ? 'local' : m.scope,
        orderIndex: m.orderindex,
        locked: m.locked,
        props: m.props ?? null,
        overrides: m.overrides ?? null,
        globalSlug: m.global_slug ?? null,
      })),
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
        scope: m.scope === 'local' ? 'local' : (m.scope as any),
        props: m.props ?? {},
        globalSlug: m.globalSlug ?? null,
        orderIndex: m.orderIndex,
        locked: !!m.locked,
      })
      // Apply overrides for non-local modules
      if ((m.scope === 'static' || m.scope === 'global') && m.overrides) {
        await db
          .from('post_modules')
          .where('id', created.postModule.id)
          .update({ overrides: m.overrides, updated_at: new Date() })
      }
    }
    // set custom fields by slug
    if (Array.isArray(data.post?.customFields) && data.post!.customFields!.length > 0) {
      const now = new Date()
      for (const f of data.post!.customFields!) {
        const value = typeof f.value === 'string' ? JSON.stringify(f.value) : f.value
        await db.table('post_custom_field_values').insert({
          id: (await import('node:crypto')).randomUUID(),
          post_id: post.id,
          field_slug: f.slug,
          value: value as any,
          created_at: now,
          updated_at: now,
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
    const existing = await db
      .from('post_modules')
      .join('module_instances', 'post_modules.module_id', 'module_instances.id')
      .where('post_modules.post_id', postId)
      .select('post_modules.id as pmid', 'module_instances.id as miid', 'module_instances.scope')
    if (existing.length) {
      await db
        .from('post_modules')
        .whereIn(
          'id',
          existing.map((r: any) => r.pmid)
        )
        .delete()
      const deletable = existing.filter((r: any) => r.scope !== 'global').map((r: any) => r.miid)
      if (deletable.length) {
        await db.from('module_instances').whereIn('id', deletable).delete()
      }
    }
    for (const m of data.modules || []) {
      const created = await AddModuleToPost.handle({
        postId,
        moduleType: m.type,
        scope: m.scope === 'local' ? 'local' : (m.scope as any),
        props: m.props ?? {},
        globalSlug: m.globalSlug ?? null,
        orderIndex: m.orderIndex,
        locked: !!m.locked,
      })
      if ((m.scope === 'static' || m.scope === 'global') && m.overrides) {
        await db
          .from('post_modules')
          .where('id', created.postModule.id)
          .update({ overrides: m.overrides, updated_at: new Date() })
      }
    }
    // Replace custom fields by slug
    if (Array.isArray(data.post?.customFields)) {
      const now = new Date()
      for (const f of data.post!.customFields!) {
        const value = typeof f.value === 'string' ? JSON.stringify(f.value) : f.value
        const updated = await db
          .from('post_custom_field_values')
          .where({ post_id: postId, field_slug: f.slug })
          .update({ value: value as any, updated_at: now } as any)
        if (!updated) {
          await db.table('post_custom_field_values').insert({
            id: (await import('node:crypto')).randomUUID(),
            post_id: postId,
            field_slug: f.slug,
            value: value as any,
            created_at: now,
            updated_at: now,
          })
        }
      }
    }
  }
}
