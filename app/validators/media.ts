import vine from '@vinejs/vine'
import { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Media validators
 *
 * Validation rules for media uploads and updates.
 */

/**
 * Media query validator (for list/index filtering)
 */
export const mediaQueryValidator = vine.compile(
  vine.object({
    limit: vine.number().min(1).max(100).optional(),
    page: vine.number().min(1).optional(),
    sortBy: vine.string().trim().optional(),
    sortOrder: vine.enum(['asc', 'desc']).optional(),
    category: vine.string().trim().optional(),
    q: vine.string().trim().optional(),
  })
)

/**
 * Media upload validator (for form fields, not file itself)
 * Note: File validation happens in controller due to multipart/form-data
 */
export const mediaUploadValidator = vine.compile(
  vine.object({
    altText: vine.string().trim().maxLength(500).optional(),
    title: vine.string().trim().maxLength(255).optional(),
    description: vine.string().trim().maxLength(2000).optional(),
    naming: vine.enum(['uuid', 'original']).optional(),
    appendIdIfExists: vine.boolean().optional(),
    categories: vine.array(vine.string().trim().maxLength(100)).optional(),
  })
)

mediaUploadValidator.messagesProvider = new SimpleMessagesProvider({
  'altText.maxLength': 'Alt text must not exceed 500 characters',
  'title.maxLength': 'Title must not exceed 255 characters',
  'description.maxLength': 'Description must not exceed 2000 characters',
  'naming.enum': 'Naming must be either "uuid" or "original"',
})

/**
 * Update media validator
 */
export const updateMediaValidator = vine.compile(
  vine.object({
    altText: vine.string().trim().maxLength(500).nullable().optional(),
    title: vine.string().trim().maxLength(255).nullable().optional(),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    categories: vine.array(vine.string().trim().maxLength(100)).optional(),
  })
)

updateMediaValidator.messagesProvider = new SimpleMessagesProvider({
  'altText.maxLength': 'Alt text must not exceed 500 characters',
  'title.maxLength': 'Title must not exceed 255 characters',
  'description.maxLength': 'Description must not exceed 2000 characters',
})

/**
 * Bulk media operations validator
 */
export const bulkMediaValidator = vine.compile(
  vine.object({
    ids: vine.array(vine.string().uuid()).minLength(1).maxLength(100),
    action: vine.enum(['delete', 'optimize', 'generateVariants', 'updateCategories']).optional(),
    categories: vine.array(vine.string().trim().maxLength(100)).optional(),
  })
)

bulkMediaValidator.messagesProvider = new SimpleMessagesProvider({
  'ids.required': 'At least one media ID is required',
  'ids.minLength': 'At least one media ID is required',
  'ids.maxLength': 'Cannot process more than 100 items at once',
  'action.enum': 'Action must be one of: delete, optimize, generateVariants, updateCategories',
})
