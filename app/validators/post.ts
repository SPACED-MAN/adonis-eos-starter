import vine from '@vinejs/vine'

/**
 * Post validators
 *
 * Centralized validation rules for post-related operations.
 */

/**
 * Create post validator
 */
export const createPostValidator = vine.compile(
  vine.object({
    type: vine.string().trim().minLength(1).maxLength(50),
    locale: vine.string().trim().minLength(2).maxLength(10),
    slug: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(255)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: vine.string().trim().minLength(1).maxLength(500),
    status: vine
      .enum(['draft', 'review', 'scheduled', 'published', 'private', 'protected', 'archived'])
      .optional(),
    excerpt: vine.string().trim().maxLength(1000).nullable().optional(),
    metaTitle: vine.string().trim().maxLength(255).nullable().optional(),
    metaDescription: vine.string().trim().maxLength(500).nullable().optional(),
    moduleGroupId: vine.string().uuid().nullable().optional(),
  })
)

/**
 * Update post validator
 */
export const updatePostValidator = vine.compile(
  vine.object({
    slug: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(255)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    status: vine
      .enum(['draft', 'review', 'scheduled', 'published', 'private', 'protected', 'archived'])
      .optional(),
    excerpt: vine.string().trim().maxLength(1000).nullable().optional(),
    parentId: vine.string().uuid().nullable().optional(),
    orderIndex: vine.number().min(0).optional(),
    metaTitle: vine.string().trim().maxLength(255).nullable().optional(),
    metaDescription: vine.string().trim().maxLength(500).nullable().optional(),
    canonicalUrl: vine.string().trim().url().nullable().optional(),
    robotsJson: vine.any().optional(),
    jsonldOverrides: vine.any().optional(),
    scheduledAt: vine.string().optional(),
    mode: vine.enum(['publish', 'review', 'approve']).optional(),
    // Featured image (Media ID). Optional and nullable.
    featuredImageId: vine.string().uuid().nullable().optional(),
    customFields: vine.array(vine.any()).optional(),
    taxonomyTermIds: vine.array(vine.string().uuid()).optional(),
  })
)

/**
 * Add module to post validator
 */
export const addModuleValidator = vine.compile(
  vine.object({
    moduleType: vine.string().trim().minLength(1).maxLength(50),
    scope: vine.enum(['local', 'global']).optional(),
    props: vine.any().optional(),
    globalSlug: vine.string().trim().maxLength(100).nullable().optional(),
    orderIndex: vine.number().min(0).optional(),
    locked: vine.boolean().optional(),
    mode: vine.enum(['publish', 'review']).optional(),
  })
)

/**
 * Update post module validator
 */
export const updateModuleValidator = vine.compile(
  vine.object({
    orderIndex: vine.number().min(0).optional(),
    overrides: vine.any().optional(),
    locked: vine.boolean().optional(),
    mode: vine.enum(['publish', 'review']).optional(),
  })
)

/**
 * Bulk action validator
 */
export const bulkActionValidator = vine.compile(
  vine.object({
    action: vine.enum([
      'publish',
      'draft',
      'archive',
      'delete',
      'duplicate',
      'regeneratePermalinks',
    ]),
    ids: vine.array(vine.string().uuid()).minLength(1).maxLength(100),
  })
)

/**
 * Reorder posts validator
 */
export const reorderPostsValidator = vine.compile(
  vine.object({
    scope: vine.object({
      type: vine.string().trim().minLength(1),
      locale: vine.string().trim().minLength(2),
      parentId: vine.string().uuid().nullable().optional(),
    }),
    items: vine
      .array(
        vine.object({
          id: vine.string().uuid(),
          orderIndex: vine.number().min(0),
          parentId: vine.string().uuid().nullable().optional(),
        })
      )
      .minLength(1)
      .maxLength(500),
  })
)

/**
 * Import post validator
 */
export const importPostValidator = vine.compile(
  vine.object({
    data: vine.object({
      version: vine.string().optional(),
      post: vine.object({
        type: vine.string(),
        locale: vine.string(),
        slug: vine.string(),
        title: vine.string(),
        status: vine.string().optional(),
        excerpt: vine.string().nullable().optional(),
        metaTitle: vine.string().nullable().optional(),
        metaDescription: vine.string().nullable().optional(),
      }),
      modules: vine.array(vine.any()).optional(),
      translations: vine.array(vine.any()).optional(),
    }),
    mode: vine.enum(['replace', 'review']).optional(),
  })
)

/**
 * Create translation validator
 */
export const createTranslationValidator = vine.compile(
  vine.object({
    locale: vine.string().trim().minLength(2).maxLength(10),
    slug: vine
      .string()
      .trim()
      .minLength(1)
      .maxLength(255)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    title: vine.string().trim().minLength(1).maxLength(500).optional(),
    metaTitle: vine.string().trim().maxLength(255).nullable().optional(),
    metaDescription: vine.string().trim().maxLength(500).nullable().optional(),
  })
)

/**
 * Update author validator
 */
export const updateAuthorValidator = vine.compile(
  vine.object({
    authorId: vine.number().positive(),
  })
)
