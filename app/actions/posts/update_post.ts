import logActivityAction from '#actions/log_activity_action'
import dispatchWebhookAction from '#actions/dispatch_webhook_action'
import Post from '#models/post'
import { DateTime } from 'luxon'
import urlPatternService from '#services/url_pattern_service'
import postTypeConfigService from '#services/post_type_config_service'
import ApplyPostTaxonomyAssignments from '#actions/posts/apply_post_taxonomy_assignments'
import db from '@adonisjs/lucid/services/db'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

type UpdatePostParams = {
  postId: string
  slug?: string
  title?: string
  status?: 'draft' | 'review' | 'scheduled' | 'published' | 'private' | 'protected' | 'archived'
  excerpt?: string | null
  parentId?: string | null
  orderIndex?: number
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
  featuredMediaId?: string | null
  taxonomyTermIds?: string[]
  scheduledAt?: string | null
}

export class UpdatePostException extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public meta?: Record<string, any>
  ) {
    super(message)
    this.name = 'UpdatePostException'
  }
}

export default class UpdatePost {
  static async handle(
    {
      postId,
      slug,
      title,
      status,
      excerpt,
      parentId,
      orderIndex,
      metaTitle,
      metaDescription,
      canonicalUrl,
      robotsJson,
      jsonldOverrides,
      socialTitle,
      socialDescription,
      socialImageId,
      noindex,
      nofollow,
      featuredMediaId,
      taxonomyTermIds,
      scheduledAt,
    }: UpdatePostParams,
    trx?: TransactionClientContract
  ): Promise<Post> {
    // Find the post
    const query = Post.query()
    if (trx) query.useTransaction(trx)
    const post = await query.where('id', postId).first()

    if (!post) {
      throw new UpdatePostException('Post not found', 404, { postId })
    }

    if (trx) post.useTransaction(trx)

    // If slug is being changed, normalize and check uniqueness
    if (slug) {
      let newSlug = slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')

      if (newSlug.includes('/')) {
        newSlug = newSlug.replace(/^\/+/, '').split('/').pop() || newSlug
      }
      if (newSlug !== post.slug) {
        const existingPost = await Post.query()
          .where('slug', newSlug)
          .where('locale', post.locale)
          .whereNot('id', postId)
          .first()

        if (existingPost) {
          throw new UpdatePostException(
            'A post with this slug already exists for this locale',
            409,
            { slug: newSlug, locale: post.locale }
          )
        }

        // Conditionally create a 301 redirect from old path to new path (locale-aware)
        // IMPORTANT: Must check and create redirect BEFORE changing the slug
        const shouldAutoRedirect = await (async () => {
          // Check database settings first (runtime configuration takes precedence)
          const dbSettings = await db
            .from('post_type_settings')
            .where('post_type', post.type)
            .first()

          if (dbSettings && (dbSettings as any).settings?.autoRedirectOnSlugChange !== undefined) {
            return !!(dbSettings as any).settings.autoRedirectOnSlugChange
          }

          // Fall back to post type config file
          const cfg = postTypeConfigService.getUiConfig(post.type)
          return (cfg as any).autoRedirectOnSlugChange !== undefined
            ? !!(cfg as any).autoRedirectOnSlugChange
            : false // default false when not provided (auto-redirects disabled by default)
        })()

        if (shouldAutoRedirect) {
          // Capture old URL BEFORE changing slug
          const fromPath =
            post.canonicalUrl || (await urlPatternService.buildPostPathForPost(post.id))

          // Generate new URL using the NEW slug but WITHOUT relying on DB state
          const toPath = await urlPatternService.buildPostPathForPostWithSlug(post.id, newSlug)

          try {
            const existing = await db.from('url_redirects').where('from_path', fromPath).first()
            if (!existing) {
              const now = new Date()
              await db.table('url_redirects').insert({
                from_path: fromPath,
                to_path: toPath,
                locale: post.locale,
                http_status: 301,
                post_id: post.id,
                created_at: now,
                updated_at: now,
              })
            }
          } catch {
            // ignore redirect insert errors
          }
        }

        // Now save the new slug
        post.slug = newSlug
      }
    }

    // Update other fields if provided
    if (title !== undefined) post.title = title
    if (status !== undefined) post.status = status
    if (excerpt !== undefined) post.excerpt = excerpt
    if (parentId !== undefined) {
      // Normalize: empty string => null
      const normalized = parentId === '' ? null : parentId
      // Prevent self-parenting
      if (normalized && normalized === postId) {
        post.parentId = null
      } else {
        post.parentId = (normalized as any) ?? null
      }
    }
    if (orderIndex !== undefined && !Number.isNaN(Number(orderIndex))) {
      post.orderIndex = Number(orderIndex)
    }
    if (metaTitle !== undefined) post.metaTitle = metaTitle
    if (metaDescription !== undefined) post.metaDescription = metaDescription
    if (canonicalUrl !== undefined) post.canonicalUrl = canonicalUrl
    if (robotsJson !== undefined) post.robotsJson = robotsJson
    if (jsonldOverrides !== undefined) post.jsonldOverrides = jsonldOverrides
    if (socialTitle !== undefined) post.socialTitle = socialTitle
    if (socialDescription !== undefined) post.socialDescription = socialDescription
    if (socialImageId !== undefined) {
      post.socialImageId = socialImageId === '' ? null : socialImageId
    }
    if (noindex !== undefined) post.noindex = noindex
    if (nofollow !== undefined) post.nofollow = nofollow
    if (featuredMediaId !== undefined) {
      // Normalize: empty string => null
      post.featuredMediaId = featuredMediaId === '' ? null : featuredMediaId
    }

    // Handle timestamps and status-related side effects
    if (status === 'published') {
      post.publishedAt = DateTime.now()
      post.scheduledAt = null
    } else if (status === 'scheduled' && scheduledAt) {
      const ts = DateTime.fromISO(scheduledAt)
      if (ts.isValid) {
        post.scheduledAt = ts
      }
    } else if (status === 'draft') {
      post.scheduledAt = null
    }

    await post.save()

    // 3. Update taxonomy assignments if provided
    if (taxonomyTermIds) {
      await ApplyPostTaxonomyAssignments.handle({
        postId: post.id,
        postType: post.type,
        termIds: taxonomyTermIds,
      })
    }

    // 4. Auto-update canonical URL if slug changed or if it's not set and wasn't explicitly provided.
    // We do this AFTER the first save so buildPostPathForPost can read the latest slug/hierarchy from DB.
    if ((slug && post.slug !== slug) || (canonicalUrl === undefined && !post.canonicalUrl)) {
      try {
        const newCanonicalPath = await urlPatternService.buildPostPathForPost(post.id)
        if (newCanonicalPath && newCanonicalPath !== post.canonicalUrl) {
          post.canonicalUrl = newCanonicalPath
          await post.save()
        }
      } catch {
        // If canonical URL generation fails, continue without it
      }
    }

    // Log activity
    await logActivityAction.handle({
      action: 'post.update',
      userId: (trx as any)?.userId || null, // Best effort to get userId if passed through trx metadata
      entityType: 'post',
      entityId: post.id,
    })

    // Dispatch webhooks
    await dispatchWebhookAction.handle({
      event: 'post.updated',
      data: { id: post.id },
    })

    if (status === 'published' && post.status !== 'published') {
      await dispatchWebhookAction.handle({
        event: 'post.published',
        data: { id: post.id },
      })
    }

    return post
  }
}
