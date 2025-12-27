import vine from '@vinejs/vine'

/**
 * Query parameter validators
 *
 * Reusable validators for common query parameters (pagination, filters, etc.)
 */

/**
 * Pagination query validator
 */
export const paginationQueryValidator = vine.compile(
  vine.object({
    limit: vine.number().min(1).max(200).optional(),
    offset: vine.number().min(0).optional(),
    page: vine.number().min(1).optional(),
  })
)

/**
 * Audit logs query validator
 */
export const auditLogsQueryValidator = vine.compile(
  vine.object({
    userId: vine.number().positive().optional(),
    action: vine.string().trim().maxLength(100).optional(),
    entityType: vine.string().trim().maxLength(100).optional(),
    startDate: vine.string().optional(), // ISO date string
    endDate: vine.string().optional(), // ISO date string
    limit: vine.number().min(1).max(200).optional(),
    offset: vine.number().min(0).optional(),
    page: vine.number().min(1).optional(),
    q: vine.string().trim().maxLength(500).optional(),
    sortBy: vine.string().trim().optional(),
    sortOrder: vine.enum(['asc', 'desc']).optional(),
  })
)

/**
 * Media query validator
 */
export const mediaQueryValidator = vine.compile(
  vine.object({
    limit: vine.number().min(1).max(100).optional(),
    page: vine.number().min(1).optional(),
    sortBy: vine.enum(['created_at', 'original_filename', 'size']).optional(),
    sortOrder: vine.enum(['asc', 'desc']).optional(),
    category: vine.string().trim().maxLength(100).optional(),
    q: vine.string().trim().maxLength(500).optional(), // Search query
  })
)

/**
 * Site search query validator
 */
export const siteSearchQueryValidator = vine.compile(
  vine.object({
    q: vine.string().trim().maxLength(500).optional(),
    type: vine.string().trim().maxLength(50).optional(),
    locale: vine.string().trim().minLength(2).maxLength(10).optional(),
    limit: vine.number().min(1).max(100).optional(),
  })
)

/**
 * Activity logs query validator
 */
export const activityLogsQueryValidator = auditLogsQueryValidator
